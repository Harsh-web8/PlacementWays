import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { scanRecruitmentSources } from "@/server/recruitment/monitor";

const { serviceClient, lookup, request } = vi.hoisted(() => ({
  serviceClient: vi.fn(), lookup: vi.fn(), request: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ serviceClient }));
vi.mock("node:dns/promises", () => ({ lookup }));
vi.mock("node:https", () => ({ request }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("queues an outage fallback then retries extraction against the original snapshot", async () => {
  const original = "Original fixture source with no supported changes.";
  const quote = "Revised fixture eligibility applies.";
  const sourceText = `${quote} This is a synthetic notice for exercising recruitment import. It contains no real employer facts.`;
  const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
  const source = {
    id: "source", company_id: "company", role_id: "role", drive_id: null,
    label: "Fixture notice", source_url: "https://careers.example.test/notice",
    last_fingerprint: fingerprint(original), last_ai_fingerprint: fingerprint(original),
    last_excerpt: original, poll_interval_minutes: 360, consecutive_failures: 0,
  };
  const role = { id: "role", company_id: "company", title: "Fixture role", slug: "fixture-role", eligibility: "Previous eligibility" };
  const queue = vi.fn().mockResolvedValue({ data: true, error: null });
  const snapshot = vi.fn(() => ({ data: { previous_excerpt: original }, error: null }));
  const saved = vi.fn((values) => Object.assign(source, values));
  const rpc = vi.fn((name: string, args: unknown) =>
    name === "claim_recruitment_watch_sources" ? { data: [{ ...source }], error: null } : queue(args));
  const from = (name: string) => {
    const query = {
      select: () => query, eq: () => query,
      limit: () => ({ data: name === "company_roles" ? [role] : [], error: null }),
      in: () => query,
      maybeSingle: () => name === "company_roles" ? { data: role, error: null } : snapshot(),
      update: (values: object) => { saved(values); return query; },
    };
    return query;
  };
  serviceClient.mockReturnValue({ rpc, from });
  vi.stubEnv("RECRUITMENT_ALLOWED_HOSTS", "careers.example.test");
  vi.stubEnv("OPENAI_API_KEY", "local-synthetic-fixture");
  lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  request.mockImplementation((_url, options, onResponse) => {
    const req = new EventEmitter();
    return Object.assign(req, { end() {
      expect(options.family).toBe(4);
      expect(options.signal).toBeInstanceOf(AbortSignal);
      const response = Object.assign(new EventEmitter(), { statusCode: 200, headers: { "content-type": "text/html" } });
      onResponse(response);
      response.emit("data", Buffer.from(`<p>${sourceText}</p>`));
      response.emit("end");
    } });
  });
  const ai = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: JSON.stringify({
      headline: "Updated fixture eligibility", summary: quote, evidence: quote, classification: "eligibility",
      field_changes: [
        { target_kind: "role", field_key: "eligibility", value: quote, evidence_quote: quote },
        { target_kind: "role", field_key: "salary_details", value: "Invented number", evidence_quote: "Missing evidence quote" },
      ],
    }) } }] }));
  vi.stubGlobal("fetch", ai);

  expect(await scanRecruitmentSources()).toEqual([{ source: source.label, status: "source checked; AI extraction will retry" }]);
  expect(queue).toHaveBeenNthCalledWith(1, expect.objectContaining({
    p_fingerprint: fingerprint(sourceText), p_field_changes: [], p_ai_parsed: false,
  }));
  expect(source.last_ai_fingerprint).toBe(fingerprint(original));

  expect(await scanRecruitmentSources()).toEqual([{ source: source.label, status: "proposal queued for review" }]);
  expect(snapshot).toHaveBeenCalledOnce();
  expect(JSON.parse(JSON.parse(ai.mock.calls[1][1].body).messages[1].content))
    .toMatchObject({ old_source_text: original, new_source_text: sourceText });
  expect(queue).toHaveBeenNthCalledWith(2, expect.objectContaining({
    p_fingerprint: fingerprint(sourceText), p_ai_parsed: true,
    p_field_changes: [{ target_kind: "role", target_id: "role", field_key: "eligibility",
      old_value: "Previous eligibility", new_value: quote, evidence_quote: quote }],
  }));
  expect(source.last_ai_fingerprint).toBe(fingerprint(sourceText));
});
