// End-to-end smoke test of the app against a mock Supabase.
//   npm run test:e2e
//
// IMPORTANT: NEXT_PUBLIC_* variables are inlined by Next.js at BUILD time,
// not read at runtime. So the mock's URL/key must be set before `next build`
// runs, not just before `next start` -- otherwise every code path that calls
// Supabase silently targets whatever URL was baked in by a previous build
// and fails with a generic "fetch failed" network error. This script builds
// the app itself (with the mock already listening) so the whole suite is
// self-contained and reproducible in CI.
import { spawn, spawnSync } from "node:child_process";
import { startMock, users, calls } from "./mock-supabase.mjs";
import { courseId, lessonId, learningFaults } from "./learning-fixtures.mjs";

const APP = "http://localhost:3100",
  MOCK_PORT = 54399;
const mockEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
  NEXT_PUBLIC_SITE_URL: APP,
};

const mock = await startMock(MOCK_PORT);

console.log(
  "Building app against the mock Supabase (NEXT_PUBLIC_* is inlined at build time)...",
);
const build = spawnSync("npx", ["next", "build"], {
  env: mockEnv,
  stdio: "inherit",
});
if (build.status !== 0) {
  console.error("\nBuild failed -- see output above.");
  mock.close();
  process.exit(1);
}

const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100"], {
  env: mockEnv,
  stdio: "ignore",
});
let failed = 0;
const ok = (c, label) => {
  console.log(`${c ? "ok  " : "FAIL"} - ${label}`);
  if (!c) failed++;
};
const cleanup = () => {
  app.kill("SIGTERM");
  mock.close();
};

let ready = false;
for (let i = 0; i < 60; i++) {
  try {
    const response = await fetch(APP, { signal: AbortSignal.timeout(2000) });
    if (response.ok) { ready = true; break; }
  } catch {
    // The server may still be starting. Retry after the same delay as non-OK responses.
  }
  await new Promise((r) => setTimeout(r, 500));
}

if (!ready) {
  console.error("Startup failed: app did not become ready at " + APP);
  cleanup();
  process.exit(1);
}

// Tiny cookie-jar client (redirects handled manually so we can assert them).
class Client {
  jar = new Map();
  async req(path, init = {}) {
    const res = await fetch(APP + path, {
      redirect: "manual",
      ...init,
      headers: {
        ...(init.headers ?? {}),
        cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "),
        origin: APP,
      },
    });
    for (const sc of res.headers.getSetCookie()) {
      const [pair] = sc.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i),
        v = pair.slice(i + 1);
      if (/max-age=0|expires=Thu, 01 Jan 1970/i.test(sc) || v === "")
        this.jar.delete(k);
      else this.jar.set(k, v);
    }
    return res;
  }
  // Submit a server-action form exactly as a no-JS browser would.
  async submit(pagePath, fields, formIndex = 0) {
    const html = await (await this.req(pagePath)).text();
    const form = html.split("<form")[formIndex + 1]?.split("</form>")[0] ?? "";
    const fd = new FormData();
    for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = /name="([^"]+)"/.exec(m[0])?.[1],
        value = (/value="([^"]*)"/.exec(m[0])?.[1] ?? "")
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");
      if (name) fd.append(name, value);
    }
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return this.req(pagePath, { method: "POST", body: fd });
  }
}
const loc = (r) => r.headers.get("location") ?? "";
const path = (l) => l.replace(APP, "");

try {
  // ---- Public + anonymous ------------------------------------------------
  let c = new Client();
  ok((await c.req("/")).status === 200, "homepage is public (200)");
  const deniedResult = await c.req("/attempts/00000000-0000-4000-8000-000000000001/result");
  ok(deniedResult.status === 404 && !loc(deniedResult), "unknown guest result is denied without a login redirect");
  ok(/private/.test(deniedResult.headers.get("cache-control") ?? "") && /no-store/.test(deniedResult.headers.get("cache-control") ?? ""), "attempt response cannot be stored in shared caches");
  const home = await (await c.req("/")).text();
  ok(
    home.includes('href="/login"') && home.includes('href="/register"'),
    "homepage links to /login and /register",
  );
  for (const p of ["/dashboard", "/profile", "/admin", "/admin/anything"]) {
    const r = await c.req(p);
    ok(
      r.status === 307 && path(loc(r)).startsWith("/login?next="),
      `anonymous ${p} -> redirected to /login with next`,
    );
  }
  const r0 = await c.req("/dashboard");
  ok(
    r0.headers.get("cache-control")?.includes("no-store"),
    "protected redirect is not cacheable",
  );
  ok(
    /noindex/.test(await (await c.req("/login")).text()),
    "login page is noindex",
  );

  for (const p of [
    "/companies",
    "/companies/fixture-company",
    "/courses",
    "/courses/fixture-foundations",
    `/courses/fixture-foundations/lessons/${lessonId}`,
  ]) {
    const res = await c.req(p);
    ok(
      res.status === 200 &&
        !(await res.text()).includes("Something went wrong"),
      `published learning route ${p} renders`,
    );
  }
  ok(
    (await c.req("/courses/does-not-exist")).status === 404,
    "unknown course is 404",
  );
  ok(
    (await c.req("/companies/does-not-exist")).status === 404,
    "unknown company is 404",
  );

  const filters = {company:"fixture-company",category:"aptitude",difficulty:"hard",access:"premium",maxDuration:"60",minQuestions:"20"};
  const filterHtml = await (await c.req(`/tests?${new URLSearchParams(filters)}`)).text();
  const sortUrls = [...filterHtml.matchAll(/href="([^"]+)"/g)]
    .map(m=>new URL(m[1].replaceAll("&amp;","&"),APP))
    .filter(url=>url.pathname==='/tests' && url.searchParams.has('sort'));
  for (const order of ['newest','popular']) {
    const url=sortUrls.find(url=>url.searchParams.get('sort')===order);
    ok(url && Object.entries(filters).every(([key,value])=>url.searchParams.get(key)===value), `${order} sort preserves every active filter`);
  }

  learningFaults.courses = true;
  try {
    const outageResponse=await c.req("/");
    const outageHtml=await outageResponse.text();
    ok(outageResponse.status===200 && outageHtml.includes("Fixture Company") && outageHtml.includes("Courses are being prepared"), "homepage retains healthy sections when course lookup fails");
  } finally { learningFaults.courses = false; }

  // ---- Validation --------------------------------------------------------
  let r = await c.submit("/login", { email: "nope", password: "" });
  let html = await r.text();
  ok(
    r.status === 200 && /valid email/i.test(html),
    "login: server-side validation errors rendered",
  );
  r = await c.submit("/login", {
    email: "student@example.com",
    password: "WrongPass1",
  });
  html = await r.text();
  ok(
    /Incorrect email or password/.test(html),
    "login: wrong password -> generic message",
  );
  r = await c.submit("/login", {
    email: "nobody@example.com",
    password: "WrongPass1",
  });
  ok(
    /Incorrect email or password/.test(await r.text()),
    "login: unknown user -> identical message (no enumeration)",
  );
  ok(
    ![...c.jar.keys()].some((k) => k.includes("auth-token")),
    "failed logins set no session cookie",
  );

  // ---- Student login -----------------------------------------------------
  c = new Client();
  r = await c.submit("/login", {
    email: "student@example.com",
    password: "Password1",
    next: "https://evil.com",
  });
  ok(
    r.status === 303 && path(loc(r)) === "/dashboard",
    "student login -> /dashboard (open redirect next=https://evil.com ignored)",
  );
  const setCk = await (async () => {
    const x = new Client();
    const rr = await x.submit("/login", {
      email: "student@example.com",
      password: "Password1",
    });
    return rr.headers.getSetCookie().join("\n");
  })();
  ok(
    /httponly/i.test(setCk) && /samesite=lax/i.test(setCk),
    "session cookie is HttpOnly + SameSite=Lax",
  );
  r = await c.req("/dashboard");
  html = await r.text();
  ok(
    r.status === 200 && html.includes("Asha"),
    "student can open dashboard and sees own name",
  );
  ok(
    /no-store/.test(r.headers.get("cache-control") ?? ""),
    "dashboard responses are no-store",
  );
  r = await c.req("/login");
  ok(
    r.status === 307 || r.status === 303,
    "logged-in user visiting /login is redirected away",
  );
  r = await c.req("/admin");
  ok(
    r.status === 404,
    "STUDENT opening /admin gets 404 (role checked server-side)",
  );
  r = await c.req("/admin/whatever");
  ok(r.status === 404, "STUDENT opening /admin/* gets 404");

  // ---- Learning forms and dashboard ------------------------------------
  r = await c.submit("/courses/fixture-foundations", {});
  ok(
    (await r.text()).includes("Course started"),
    "student starts a free course",
  );
  r = await c.submit(`/courses/fixture-foundations/lessons/${lessonId}`, {});
  ok(
    (await r.text()).includes("Lesson completed"),
    "student completes a lesson",
  );
  html = await (await c.req("/dashboard")).text();
  ok(
    html.includes("Fixture foundations") &&
      /1.*1.*lessons completed/.test(html),
    "dashboard shows saved course completion",
  );
  ok(
    calls.some(
      (x) =>
        x.startsWith("LEARNING_RPC complete_lesson") && !x.includes("user_id"),
    ),
    "progress RPC derives identity instead of accepting a user id",
  );
  ok(
    (await c.req(`/admin/courses/${courseId}`)).status === 404,
    "student denied course editor",
  );

  // ---- Forged cookie / tampering ----------------------------------------
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const forgedToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: users["admin@example.com"].id, role: "authenticated", aud: "authenticated", exp: 9999999999 })}.sig`;
  const rejected = await fetch(`http://localhost:${MOCK_PORT}/auth/v1/user`, { headers: { authorization: `Bearer ${forgedToken}` } });
  ok(rejected.status === 401, "Auth mock rejects an unissued token with a valid admin payload");
  const forged = new Client();
  forged.jar.set(
    "sb-localhost-auth-token",
    "base64-" +
      Buffer.from(
        JSON.stringify({
          access_token: forgedToken,
          refresh_token: "r",
          expires_at: 9999999999,
          user: { id: users["admin@example.com"].id },
        }),
      ).toString("base64url"),
  );
  r = await forged.req("/admin");
  ok(
    r.status !== 200,
    `forged session cookie cannot open /admin (got ${r.status})`,
  );
  r = await forged.req("/dashboard");
  ok(
    r.status !== 200 || !(await r.text()).includes("Site Admin"),
    "forged session cookie cannot open dashboard",
  );

  // ---- Profile update ----------------------------------------------------
  r = await c.submit(
    "/profile",
    { name: "A", college: "", degree: "", graduationYear: "27" },
    1,
  );
  html = await r.text();
  ok(
    /at least 2 characters/.test(html) && /four-digit year/.test(html),
    "profile: validation errors shown",
  );
  calls.length = 0;
  r = await c.submit(
    "/profile",
    {
      name: "Asha R",
      college: "ABC College",
      degree: "B.Tech",
      graduationYear: "2027",
      role: "admin",
      id: users["admin@example.com"].id,
    },
    1,
  );
  html = await r.text();
  ok(/Profile saved/.test(html), "profile: saved with success message");
  const patch = calls.find((x) => x.startsWith("PATCH {"));
  ok(
    patch &&
      !patch.includes('"role"') &&
      !patch.includes("id") &&
      patch.includes("2027"),
    "profile update payload contains ONLY the 4 editable fields (smuggled role/id dropped)",
  );
  ok(
    users["student@example.com"].profile.role === "student",
    "smuggled role=admin had no effect",
  );

  // ---- Logout ------------------------------------------------------------
  r = await c.submit("/dashboard", {}, 0);
  ok(r.status === 303 && path(loc(r)) === "/", "logout redirects home");
  r = await c.req("/dashboard");
  ok(r.status === 307, "after logout, /dashboard is protected again");

  // ---- Admin -------------------------------------------------------------
  c = new Client();
  r = await c.submit("/login", {
    email: "admin@example.com",
    password: "Password1",
  });
  ok(path(loc(r)) === "/admin", "admin login lands on /admin");
  r = await c.req("/admin");
  html = await r.text();
  ok(
    r.status === 200 && html.includes("Admin overview"),
    "admin can open /admin",
  );
  r = await c.req("/admin/courses/new");
  ok(
    r.status === 200 && (await r.text()).includes("Price in paise"),
    "admin course creation form loads",
  );
  const validCourse = {
    title: "New foundations",
    slug: "new-foundations",
    description: "Useful course",
    company_id: "",
    category_id: "",
    mock_test_id: "",
    thumbnail_url: "",
    difficulty: "easy",
    status: "draft",
    is_free: "false",
    price_paise: "12345",
  };
  r = await c.submit(
    "/admin/courses/new",
    { ...validCourse, price_paise: "0" },
    1,
  );
  ok(
    (await r.text()).includes("positive price"),
    "invalid premium price rejected server-side",
  );
  calls.length = 0;
  r = await c.submit(
    "/admin/courses/new",
    { ...validCourse, role: "admin" },
    1,
  );
  ok(
    r.status === 303 && path(loc(r)) === `/admin/courses/${courseId}`,
    "valid admin course form saves and redirects",
  );
  ok(
    calls.some(
      (x) =>
        x.startsWith("COURSE_WRITE") &&
        x.includes("12345") &&
        !x.includes("role"),
    ),
    "course writes validated fields and database price",
  );
  c = new Client();
  r = await c.submit("/login", {
    email: "admin@example.com",
    password: "Password1",
    next: "/profile",
  });
  ok(path(loc(r)) === "/profile", "login honours a safe next=/profile");

  // ---- Inactive account --------------------------------------------------
  c = new Client();
  r = await c.submit("/login", {
    email: "inactive@example.com",
    password: "Password1",
  });
  html = await r.text();
  ok(
    /not active/.test(html),
    "deactivated account cannot log in even with the right password",
  );
  ok(
    ![...c.jar.keys()].some((k) => k.includes("auth-token")),
    "…and no session cookie is left behind",
  );

  // ---- Registration ------------------------------------------------------
  c = new Client();
  calls.length = 0;
  r = await c.submit("/register?next=%2Fattempts%2F00000000-0000-4000-8000-000000000001%2Fresult", {
    name: "New User",
    email: "New@Example.com",
    password: "abc12345",
    confirmPassword: "abc12345",
  });
  html = await r.text();
  ok(/confirmation link/.test(html), "register: success message");
  ok(calls.some(x => x === `SIGNUP_REDIRECT ${APP}/auth/confirm?next=%2Fattempts%2F00000000-0000-4000-8000-000000000001%2Fresult`), "register: confirmation redirect preserves guest result");
  ok(
    calls.some((x) => x.startsWith("SIGNUP ") && !x.includes("role")),
    "register: signup metadata carries no role",
  );
  r = await c.submit("/register", {
    name: "New User",
    email: "x@y.com",
    password: "abc12345",
    confirmPassword: "different1",
  });
  ok(
    /do not match/.test(await r.text()),
    "register: password mismatch flagged",
  );
  r = await c.submit("/register", {
    name: "New User",
    email: "x@y.com",
    password: "abcdefgh",
    confirmPassword: "abcdefgh",
  });
  ok(
    /number/.test(await r.text()),
    "register: weak password rejected server-side",
  );

  // ---- Password reset ----------------------------------------------------
  r = await c.submit("/forgot-password", { email: "whoever@example.com" });
  ok(
    /If an account exists/.test(await r.text()),
    "forgot password: generic success for any email",
  );
  r = await c.req("/reset-password");
  ok(
    r.status === 307 && path(loc(r)).startsWith("/forgot-password"),
    "reset-password without a recovery session is refused",
  );
  r = await c.req("/auth/confirm?token_hash=bad&type=recovery");
  ok(
    path(loc(r)).startsWith("/forgot-password?error=expired"),
    "expired recovery link -> forgot-password with message",
  );
  r = await c.req("/auth/confirm?type=sms&token_hash=x");
  ok(
    path(loc(r)).startsWith("/login?error=invalid_link"),
    "confirm route rejects unknown OTP types",
  );
  r = await c.req(
    "/auth/confirm?token_hash=good&type=recovery&next=https://evil.com",
  );
  ok(
    path(loc(r)) === "/reset-password",
    "valid recovery link -> /reset-password (next ignored)",
  );
  r = await c.submit("/reset-password", {
    password: "weak",
    confirmPassword: "weak",
  });
  ok(/at least 8/.test(await r.text()), "reset: policy enforced");
  r = await c.submit("/reset-password", {
    password: "BrandNew123",
    confirmPassword: "BrandNew123",
  });
  ok(
    r.status === 303 && path(loc(r)) === "/dashboard?notice=password-updated",
    "reset: success redirects to dashboard with notice",
  );
  r = await c.req("/auth/confirm?token_hash=good&type=signup&next=//evil.com");
  ok(
    path(loc(r)) === "/dashboard",
    "signup confirmation with malicious next falls back to /dashboard",
  );
} catch (e) {
  console.error("HARNESS ERROR", e);
  failed++;
} finally {
  cleanup();
}

console.log(failed ? `\n${failed} FAILED` : "\nAll smoke checks passed.");
process.exit(failed ? 1 : 0);
