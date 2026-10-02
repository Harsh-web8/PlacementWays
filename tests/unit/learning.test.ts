import { describe, it, expect } from "vitest";
import { courseSchema, lessonSchema } from "../../src/lib/validation/learning";
const course = {
  title: "Quantitative aptitude",
  slug: "quantitative-aptitude",
  description: "Study and practice",
  company_id: "",
  category_id: "",
  mock_test_id: "",
  thumbnail_url: "",
  difficulty: "easy",
  status: "draft",
  is_free: "true",
  price_paise: "0",
};
describe("course publishing validation", () => {
  it("keeps money in integer paise and does not force a fixed price", () => {
    expect(
      courseSchema.parse({ ...course, is_free: "false", price_paise: "12345" })
        .price_paise,
    ).toBe(12345);
    expect(
      courseSchema.safeParse({
        ...course,
        is_free: "false",
        price_paise: "99.5",
      }).success,
    ).toBe(false);
  });
  it("requires a consistent free/premium price", () => {
    expect(
      courseSchema.safeParse({ ...course, price_paise: "9900" }).success,
    ).toBe(false);
    expect(
      courseSchema.safeParse({ ...course, is_free: "false" }).success,
    ).toBe(false);
  });
  it("rejects active content and invalid references", () => {
    expect(
      courseSchema.safeParse({
        ...course,
        thumbnail_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      courseSchema.safeParse({ ...course, company_id: "not-a-uuid" }).success,
    ).toBe(false);
  });
});
it("rejects unsafe lesson resources and invalid duration", () => {
  const lesson = {
    title: "Percentages",
    slug: "percentages",
    module_id: "83000000-0000-4000-8000-000000000001",
    category_id: "",
    duration_minutes: "10",
    sort_order: "0",
    is_free: "false",
    status: "draft",
    body: "Example",
    video_url: "",
    resource_url: "",
  };
  expect(lessonSchema.safeParse(lesson).success).toBe(true);
  expect(
    lessonSchema.safeParse({ ...lesson, resource_url: "data:text/html,test" })
      .success,
  ).toBe(false);
  expect(
    lessonSchema.safeParse({ ...lesson, duration_minutes: "0" }).success,
  ).toBe(false);
});
