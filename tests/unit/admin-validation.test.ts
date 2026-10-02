import { describe, expect, it } from "vitest";
import { z } from "zod";
import { companySchema } from "@/lib/validation/company";
import { processSchema, stageSchema, sourceSchema } from "@/lib/validation/recruitment-process";
import { slugify } from "@/lib/utils";

const errorsOf = (r: { success: boolean; error?: z.ZodError }): Record<string, string[] | undefined> =>
  r.error ? (z.flattenError(r.error).fieldErrors as Record<string, string[] | undefined>) : {};

describe("slugify", () => {
  it("lowercases, strips accents and joins words with single hyphens", () => {
    expect(slugify("TCS NQT")).toBe("tcs-nqt");
    expect(slugify("Café Coffee Day!!")).toBe("cafe-coffee-day");
    expect(slugify("  extra   spaces  ")).toBe("extra-spaces");
    expect(slugify("-leading and trailing-")).toBe("leading-and-trailing");
  });
});

describe("companySchema", () => {
  const valid = {
    name: "TCS NQT",
    slug: "tcs-nqt",
    description: "",
    logoUrl: "",
    websiteUrl: "https://www.tcs.com",
    seoTitle: "",
    seoDescription: "",
    sortOrder: "10",
  };

  it("accepts valid input and coerces sortOrder to a number", () => {
    const r = companySchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sortOrder).toBe(10);
      expect(r.data.description).toBeNull();
      expect(r.data.websiteUrl).toBe("https://www.tcs.com");
    }
  });

  it("requires a name and a slug", () => {
    expect(errorsOf(companySchema.safeParse({ ...valid, name: "" })).name).toBeDefined();
    expect(errorsOf(companySchema.safeParse({ ...valid, slug: "" })).slug).toBeDefined();
  });

  it("rejects a slug with spaces, capitals or underscores", () => {
    expect(errorsOf(companySchema.safeParse({ ...valid, slug: "TCS NQT" })).slug).toBeDefined();
    expect(errorsOf(companySchema.safeParse({ ...valid, slug: "tcs_nqt" })).slug).toBeDefined();
    expect(errorsOf(companySchema.safeParse({ ...valid, slug: "-tcs-nqt" })).slug).toBeDefined();
  });

  it("requires logo and website URLs to start with http(s), but allows them to be blank", () => {
    expect(errorsOf(companySchema.safeParse({ ...valid, logoUrl: "www.example.com/logo.png" })).logoUrl).toBeDefined();
    const r = companySchema.safeParse({ ...valid, logoUrl: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.logoUrl).toBeNull();
  });

  it("enforces SEO title and description length limits", () => {
    expect(errorsOf(companySchema.safeParse({ ...valid, seoTitle: "x".repeat(71) })).seoTitle).toBeDefined();
    expect(errorsOf(companySchema.safeParse({ ...valid, seoDescription: "x".repeat(201) })).seoDescription).toBeDefined();
  });
});

describe("processSchema", () => {
  const valid = {
    title: "2026 campus drive",
    description: "",
    hiringYear: "2026",
    driveName: "NQT",
    eligibility: "",
    lastVerifiedOn: "",
  };

  it("accepts valid input, treating blanks as null", () => {
    const r = processSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.hiringYear).toBe(2026);
      expect(r.data.description).toBeNull();
      expect(r.data.lastVerifiedOn).toBeNull();
    }
  });

  it("requires a title", () => {
    expect(errorsOf(processSchema.safeParse({ ...valid, title: "" })).title).toBeDefined();
  });

  it("rejects a hiring year outside 2010-2100", () => {
    expect(errorsOf(processSchema.safeParse({ ...valid, hiringYear: "1999" })).hiringYear).toBeDefined();
    expect(errorsOf(processSchema.safeParse({ ...valid, hiringYear: "2101" })).hiringYear).toBeDefined();
  });

  it("rejects a verification date in the future", () => {
    const nextYear = String(new Date().getFullYear() + 1);
    expect(errorsOf(processSchema.safeParse({ ...valid, lastVerifiedOn: `${nextYear}-01-01` })).lastVerifiedOn).toBeDefined();
  });

  it("accepts today as a verification date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(processSchema.safeParse({ ...valid, lastVerifiedOn: today }).success).toBe(true);
  });
});

describe("stageSchema", () => {
  const valid = {
    name: "Online assessment",
    stageType: "online_assessment",
    description: "",
    topics: "Arrays, Recursion,  Time complexity ,",
    durationMinutes: "60",
    questionCount: "20",
  };

  it("accepts valid input and splits topics into a trimmed array", () => {
    const r = stageSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.topics).toEqual(["Arrays", "Recursion", "Time complexity"]);
      expect(r.data.durationMinutes).toBe(60);
    }
  });

  it("rejects an unknown stage type", () => {
    expect(errorsOf(stageSchema.safeParse({ ...valid, stageType: "not-a-real-type" })).stageType).toBeDefined();
  });

  it("rejects zero or negative duration and question count", () => {
    expect(errorsOf(stageSchema.safeParse({ ...valid, durationMinutes: "0" })).durationMinutes).toBeDefined();
    expect(errorsOf(stageSchema.safeParse({ ...valid, questionCount: "-1" })).questionCount).toBeDefined();
  });

  it("allows duration and question count to be blank (not yet verified)", () => {
    const r = stageSchema.safeParse({ ...valid, durationMinutes: "", questionCount: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.durationMinutes).toBeNull();
      expect(r.data.questionCount).toBeNull();
    }
  });

  it("treats blank topics as an empty list, not an error", () => {
    const r = stageSchema.safeParse({ ...valid, topics: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.topics).toEqual([]);
  });
});

describe("sourceSchema", () => {
  it("accepts a valid label and URL", () => {
    expect(sourceSchema.safeParse({ label: "Official careers page", url: "https://example.com" }).success).toBe(true);
  });

  it("requires both a label and a URL", () => {
    expect(errorsOf(sourceSchema.safeParse({ label: "", url: "https://example.com" })).label).toBeDefined();
    expect(errorsOf(sourceSchema.safeParse({ label: "Official page", url: "" })).url).toBeDefined();
  });

  it("rejects a URL without an http(s) scheme", () => {
    expect(errorsOf(sourceSchema.safeParse({ label: "Official page", url: "example.com/careers" })).url).toBeDefined();
  });
});
