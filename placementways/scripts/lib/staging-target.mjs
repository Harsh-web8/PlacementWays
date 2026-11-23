export function stagingOrigin(raw, { allowLoopback = false } = {}) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("Set STAGING_BASE_URL to the isolated staging HTTPS origin."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const protocolAllowed = local ? allowLoopback && url.protocol === "http:" : url.protocol === "https:";
  if (!protocolAllowed || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("STAGING_BASE_URL must be an HTTPS origin or an explicitly enabled loopback fixture.");
  }
  return url;
}

export function confirmedStaging(env) {
  if (env.DEPLOYMENT_ENV !== "staging" || env.STAGING_DB_ISOLATED !== "true") {
    throw new Error("Confirm the isolated staging deployment and database in DEPLOYMENT_ENV and STAGING_DB_ISOLATED.");
  }
  const base = stagingOrigin(env.STAGING_BASE_URL);
  if (stagingOrigin(env.NEXT_PUBLIC_SITE_URL).origin !== base.origin) {
    throw new Error("STAGING_BASE_URL and NEXT_PUBLIC_SITE_URL must identify the same staging deployment.");
  }
  return base;
}

export function stagingProtectionHeaders(base, secret, { cookie = false } = {}) {
  if (!secret) return {};
  if (base.protocol !== "https:") throw new Error("Deployment protection can only be used over HTTPS.");
  return {
    "x-vercel-protection-bypass": secret,
    ...(cookie ? { "x-vercel-set-bypass-cookie": "true" } : {}),
  };
}

// Keep the staging bypass credential on requests to this deployment only.
export function stagingFetch(base, secret, fetchImpl = fetch) {
  const protection = stagingProtectionHeaders(base, secret);
  return (url, options = {}) => {
    const target = new URL(url, base);
    if (target.origin !== base.origin || target.username || target.password) throw new Error("Staging request left the configured origin.");
    const headers = new Headers(options.headers);
    for (const [key, value] of Object.entries(protection)) headers.set(key, value);
    return fetchImpl(target, { ...options, headers, redirect: options.redirect === "error" ? "error" : "manual" });
  };
}

export async function verifyStagingRobots(base, fetchImpl = fetch) {
  const response = await fetchImpl(new URL("/robots.txt", base), {
    redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || !/^Disallow:\s*\/\s*$/im.test(await response.text())) {
    throw new Error("The target does not have staging crawler restrictions.");
  }
}
