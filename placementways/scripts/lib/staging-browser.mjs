import assert from "node:assert/strict";
import { stagingProtectionHeaders } from "./staging-target.mjs";

export const FIXTURE = Object.freeze({
  mock: "/tests/pw-staging-acceptance-mock",
  coding: "/questions/pw-staging-acceptance-coding",
  role: "/companies/pw-staging-acceptance/roles/pw-staging-acceptance-role",
  course: "/courses/pw-staging-acceptance-course",
});

const privateResponse = (response) => {
  const cache = response.headers()["cache-control"] ?? "";
  return /\bprivate\b/i.test(cache) && /\bno-store\b/i.test(cache);
};

async function open(page, path, base) {
  const response = await page.goto(new URL(path, base).href);
  assert.equal(response?.status(), 200);
  assert.equal(new URL(page.url()).origin, base.origin);
  assert.equal(new URL(page.url()).pathname, path);
  return response;
}

export async function openProtectedBrowser(context, base, bypass) {
  if (!bypass) return;
  // Bootstrap the Vercel cookie before navigation. The secret stays out of page requests.
  const response = await context.request.get(new URL("/robots.txt", base).href, {
    headers: stagingProtectionHeaders(base, bypass, { cookie: true }),
    maxRedirects: 0,
    timeout: 10000,
  });
  assert.ok(response.status() >= 200 && response.status() < 400, "Staging protection rejected the browser");
  const probe = await context.request.get(new URL("/robots.txt", base).href, { maxRedirects: 0, timeout: 10000 });
  assert.equal(probe.status(), 200, "Staging protection cookie did not authorize the browser");
}

export async function checkPublicBrowser(browser, base, options = {}, bypass) {
  const context = await browser.newContext({ ...options, viewport: { width: 320, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", () => errors.push("Uncaught browser error"));
  try {
    await openProtectedBrowser(context, base, bypass);
    await open(page, "/", base);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Skip to main content");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "main-content");
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "SQL Lab" }).click();
    await page.getByRole("heading", { name: "SQL Practice Lab" }).waitFor();
    assert.equal(await page.getByRole("main").count(), 1);

    const query = page.getByLabel("Write your SQL query");
    await page.getByLabel("Question").selectOption("groups");
    const requests = [];
    page.on("request", (request) => requests.push(request.resourceType()));
    await context.setOffline(true);
    await query.fill("SELECT department, COUNT(*) AS total FROM employees GROUP BY department ORDER BY total DESC, department ASC");
    await page.getByRole("button", { name: "Check answer" }).click();
    await page.getByRole("status").filter({ hasText: "Correct!" }).waitFor();
    assert.ok(requests.every(type => !["fetch", "xhr"].includes(type)), "grading required an HTTP request");
    await context.setOffline(false);

    for (const path of ["/", "/companies", "/recruitment", "/tests", "/practice", "/courses", "/coding", "/sql"]) {
      await open(page, path, base);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflows at ${path}`);
    }
    assert.equal(errors.length, 0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "/companies", base);
    await page.getByRole("navigation", { name: "Main navigation" }).waitFor();
    return await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return { ttfbMs: Math.round(nav.responseStart), documentMs: Math.round(nav.domContentLoadedEventEnd) };
    });
  } finally {
    await context.close();
  }
}

export async function checkGuestFixtures(browser, base, {
  paths = FIXTURE, contextOptions = {}, expectedApiCases = 2,
  lessonLink = /acceptance lesson/i, lessonBody = "PlacementWays staging acceptance lesson body.",
  bypass,
} = {}) {
  const guest = await browser.newContext({ ...contextOptions, viewport: { width: 320, height: 720 } });
  const other = await browser.newContext(contextOptions);
  try {
    await Promise.all([openProtectedBrowser(guest, base, bypass), openProtectedBrowser(other, base, bypass)]);
    const page = await guest.newPage();
    await open(page, paths.role, base);
    await page.getByRole("heading", { name: "Selection rounds" }).waitFor();
    await open(page, paths.course, base);
    await page.getByRole("link", { name: lessonLink }).click();
    await page.getByText(lessonBody, { exact: true }).waitFor();

    await open(page, paths.mock, base);
    await page.getByRole("button", { name: "Start test" }).click();
    await page.waitForURL(url => url.origin === base.origin && /^\/attempts\/[a-f0-9-]+$/.test(url.pathname));
    const attemptPath = new URL(page.url()).pathname;
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit test" }).click();
    await page.waitForURL(new URL(`${attemptPath}/result`, base).href);
    await page.getByText("Submitted", { exact: true }).waitFor();
    const resultPage = await page.reload();
    assert.ok(privateResponse(resultPage));
    assert.equal((await other.request.get(new URL(`${attemptPath}/result`, base).href, { maxRedirects: 0 })).status(), 404);

    await open(page, paths.coding, base);
    await page.getByLabel("Language").selectOption("python");
    await page.getByLabel("Your code").fill("print(42)");
    await page.getByRole("button", { name: "Submit for grading" }).click();
    await page.waitForURL(url => url.origin === base.origin && /^\/coding\/submissions\/[a-f0-9-]+$/.test(url.pathname));
    const codingPath = new URL(page.url()).pathname;
    await page.getByRole("status").filter({ hasText: /^accepted$/i }).waitFor({ timeout: 120000 });
    const apiPath = new URL(`/api${codingPath}`, base).href;
    const verdict = await guest.request.get(apiPath, { maxRedirects: 0 });
    assert.equal(verdict.status(), 200);
    assert.ok(privateResponse(verdict));
    const data = await verdict.json();
    assert.equal(data.passed, expectedApiCases);
    assert.equal(data.total, expectedApiCases);
    if (expectedApiCases > 1) assert.ok(data.feedback.some(item => item.sample === false));
    for (const item of data.feedback.filter(item => !item.sample)) {
      assert.ok(["stdout", "stderr", "compile_output", "input", "expected_output"].every(key => !(key in item)));
    }
    const denied = await other.request.get(apiPath, { maxRedirects: 0 });
    assert.equal(denied.status(), 404);
    assert.ok(privateResponse(denied));
  } finally {
    await Promise.all([guest.close(), other.close()]);
  }
}

export async function checkHostedAuth(browser, base, account, admin, bypass) {
  const context = await browser.newContext();
  try {
    await openProtectedBrowser(context, base, bypass);
    const page = await context.newPage();
    await open(page, "/login", base);
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(new URL(admin ? "/admin" : "/dashboard", base).href);
    const response = await page.goto(new URL("/admin/recruitment", base).href);
    assert.equal(response?.status(), admin ? 200 : 404);
    if (admin) await page.getByRole("heading", { name: "Recruitment intelligence" }).waitFor();
  } finally {
    await context.close();
  }
}
