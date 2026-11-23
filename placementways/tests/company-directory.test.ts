import { describe, expect, it } from "vitest";
import { filterCompanyDirectory, type DirectoryCompany } from "@/lib/company-directory";
const companies: DirectoryCompany[] = [
  { id: "1", name: "Alpha Tech", slug: "alpha", description: "Cloud services", roles: [{slug:"ase",title:"Associate Software Engineer"}], publishedDriveCount: 2, listedOpenDriveCount: 0 },
  { id: "2", name: "Beta Labs", slug: "beta", description: null, roles: [], publishedDriveCount: 0, listedOpenDriveCount: 0 },
  { id: "3", name: "Gamma", slug: "gamma", description: "Analytics company", roles: [{slug:"data",title:"Data Analyst"},{slug:"sde",title:"Software Developer"}], publishedDriveCount: 1, listedOpenDriveCount: 0 },
];
describe("public company directory", () => {
  it("searches role names as well as company names", () => expect(filterCompanyDirectory(companies,"data analyst").map(c=>c.name)).toEqual(["Gamma"]));
  it("requires every search term to match", () => expect(filterCompanyDirectory(companies,"data engineer")).toEqual([]));
  it("filters companies with published roles", () => expect(filterCompanyDirectory(companies,"","with-roles")).toHaveLength(2));
  it("filters companies with published drives", () => expect(filterCompanyDirectory(companies,"","with-drives")).toHaveLength(2));
  it("sorts by number of roles", () => expect(filterCompanyDirectory(companies,"","all","most-roles")[0].name).toBe("Gamma"));
  it("does not mutate original input ordering", () => { filterCompanyDirectory(companies,"","all","most-roles"); expect(companies[0].name).toBe("Alpha Tech"); });
});
