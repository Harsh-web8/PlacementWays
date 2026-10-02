// Minimal in-memory imitation of the Supabase endpoints our app calls.
// TEST-ONLY. It verifies our app's wiring (cookies, redirects, role checks),
// NOT Supabase itself -- the real Auth/RLS behaviour is covered by the SQL tests.
import http from "node:http";
import crypto from "node:crypto";
import { learningRequest } from "./learning-fixtures.mjs";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const issuedTokens = new Set();
const jwt = (u) => {
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    exp: Math.floor(Date.now() / 1000) + 3600,
    session_id: crypto.randomUUID(),
  })}.sig`;
  issuedTokens.add(token);
  return token;
};

export const users = {
  "student@example.com": {
    id: "11111111-1111-1111-1111-111111111111",
    email: "student@example.com",
    password: "Password1",
    profile: {
      name: "Asha Rao",
      role: "student",
      is_active: true,
      college: null,
      degree: null,
      graduation_year: null,
    },
  },
  "admin@example.com": {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    email: "admin@example.com",
    password: "Password1",
    profile: {
      name: "Site Admin",
      role: "admin",
      is_active: true,
      college: null,
      degree: null,
      graduation_year: null,
    },
  },
  "inactive@example.com": {
    id: "33333333-3333-3333-3333-333333333333",
    email: "inactive@example.com",
    password: "Password1",
    profile: {
      name: "Gone",
      role: "student",
      is_active: false,
      college: null,
      degree: null,
      graduation_year: null,
    },
  },
};
export const calls = [];

const byToken = (req) => {
  const t = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!issuedTokens.has(t)) return undefined;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(t.split(".")[1], "base64url"));
    if (exp <= Date.now() / 1000) return undefined;
    return Object.values(users).find((u) => u.id === sub);
  } catch {
    return undefined;
  }
};
const userJson = (u) => ({
  id: u.id,
  aud: "authenticated",
  role: "authenticated",
  email: u.email,
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
});
const session = (u) => ({
  access_token: jwt(u),
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "r-" + u.id,
  user: userJson(u),
});

export function startMock(port, requestHook) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let body = "";
    for await (const c of req) body += c;
    const json = (code, obj, headers = {}) => {
      res.writeHead(code, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(obj));
    };
    const b = body ? JSON.parse(body) : {};
    calls.push(`${req.method} ${url.pathname}`);

    if (
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "password"
    ) {
      const u = users[b.email];
      return u && u.password === b.password
        ? json(200, session(u))
        : json(400, {
            code: "invalid_credentials",
            error_code: "invalid_credentials",
            msg: "Invalid login credentials",
          });
    }
    if (url.pathname === "/auth/v1/user" && req.method === "GET") {
      const u = byToken(req);
      return u
        ? json(200, userJson(u))
        : json(401, { code: "bad_jwt", msg: "invalid" });
    }
    if (url.pathname === "/auth/v1/user" && req.method === "PUT") {
      const u = byToken(req);
      if (!u) return json(401, { code: "bad_jwt" });
      if (b.password === "SamePass1")
        return json(422, { code: "same_password", msg: "same" });
      u.password = b.password;
      return json(200, userJson(u));
    }
    if (url.pathname === "/auth/v1/signup") {
      calls.push("SIGNUP " + JSON.stringify(b.data));
      calls.push("SIGNUP_REDIRECT " + url.searchParams.get("redirect_to"));
      return json(200, userJson({ id: crypto.randomUUID(), email: b.email }));
    }
    if (url.pathname === "/auth/v1/recover") return json(200, {});
    if (url.pathname === "/auth/v1/verify") {
      return b.token_hash === "good"
        ? json(200, session(users["student@example.com"]))
        : json(403, { code: "otp_expired", msg: "expired" });
    }
    if (url.pathname === "/auth/v1/logout") {
      issuedTokens.delete((req.headers.authorization ?? "").replace(/^Bearer /, ""));
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname.startsWith("/auth/v1/.well-known"))
      return json(200, { keys: [] });

    if (url.pathname.startsWith("/rest/v1/")) {
      const u = byToken(req);
      if (requestHook && await requestHook({ req, url, user: u, body: b, json, calls })) return;
      if (learningRequest({ req, url, user: u, body: b, json, calls })) return;
      if (!u) return json(401, { code: "PGRST301", message: "JWT required" });
      const table = url.pathname.split("/").pop();
      if (table === "profiles" && req.method === "GET") {
        const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
        const target = Object.values(users).find((x) => x.id === id);
        return target
          ? json(200, {
              id: target.id,
              email: target.email,
              ...target.profile,
              graduation_year: target.profile.graduation_year,
            })
          : json(200, null);
      }
      if (table === "profiles" && req.method === "PATCH") {
        const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
        if (id !== u.id) return json(200, []);
        Object.assign(u.profile, {
          name: b.name,
          college: b.college,
          degree: b.degree,
          graduation_year: b.graduation_year,
        });
        calls.push("PATCH " + JSON.stringify(b));
        return json(200, [{ id }]);
      }
      if (req.method === "HEAD") {
        res.writeHead(200, { "content-range": "*/0" });
        return res.end();
      }
      return json(200, []);
    }
    json(404, { msg: "mock: not found " + url.pathname });
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}
