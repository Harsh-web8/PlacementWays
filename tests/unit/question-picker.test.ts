import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const list = vi.hoisted(() => vi.fn());
vi.mock("@/server/auth/session", () => ({ requireAdmin: async () => ({ id: "admin" }) }));
vi.mock("@/server/admin/tests/queries", () => ({
  getAdminMockTest: vi.fn(),
  getAdminMockTestWithDetails: async () => ({ test: { title: "Fixture" }, questions: [{ testQuestion: { question_id: "assigned" } }] }),
}));
vi.mock("@/server/admin/categories/queries", () => ({ listAdminCategories: async () => [] }));
vi.mock("@/server/admin/questions/queries", () => ({ listAdminQuestions: list }));
vi.mock("@/server/admin/tests/actions", () => ({ addTestQuestion: vi.fn() }));
vi.mock("@/components/admin/action-button", () => ({ ActionButton: () => "Add" }));
import Page from "@/app/(admin)/admin/tests/[testId]/add-questions/page";

describe("question picker pagination", () => {
  it("keeps pagination usable when all questions on the first page are assigned", async () => {
    list.mockResolvedValue({ questions: [{ id: "assigned" }], total: 21, page: 1, pageCount: 2 });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({testId:"test"}), searchParams: Promise.resolve({q:"percent & ratio",category:"cat",difficulty:"easy",type:"mcq"}) }));
    expect(html).toContain("No unassigned questions on this page");
    expect(html).toContain("Next page");
    expect(html).toContain("page=2&amp;category=cat&amp;difficulty=easy&amp;type=mcq&amp;q=percent+%26+ratio");
  });
  it("requests and displays later questions and preserves the previous-page link", async () => {
    list.mockResolvedValue({ questions: [{ id: "available", question_text:"Later question", difficulty:"easy", question_type:"mcq", status:"published" }], total: 21, page: 2, pageCount: 2 });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({testId:"test"}), searchParams: Promise.resolve({page:"2",q:"Later"}) }));
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({page:2,status:"published",search:"Later"}));
    expect(html).toContain("Later question");
    expect(html).toContain("Previous page");
    expect(html).not.toContain("Next page");
  });
});
