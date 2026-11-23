/** Pure, browser-safe discovery logic. All listings are supplied by published-only queries. */
export type DirectoryRole = { slug: string; title: string };
export type DirectoryCompany = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  roles: DirectoryRole[];
  publishedDriveCount: number;
  listedOpenDriveCount: number;
};
export type CompanyDirectoryFilter = "all" | "with-roles" | "with-drives";
export type CompanyDirectorySort = "name" | "most-roles";

export function filterCompanyDirectory(
  companies: DirectoryCompany[],
  query: string,
  filter: CompanyDirectoryFilter = "all",
  sort: CompanyDirectorySort = "name",
): DirectoryCompany[] {
  const normalized = query.normalize("NFKC").trim().toLocaleLowerCase("en").slice(0, 100);
  const terms = normalized.split(/\s+/).filter(Boolean);
  return companies.filter(company => {
    if (filter === "with-roles" && company.roles.length === 0) return false;
    if (filter === "with-drives" && company.publishedDriveCount === 0) return false;
    const haystack = [company.name, company.description ?? "", ...company.roles.map(role => role.title)]
      .join(" ").normalize("NFKC").toLocaleLowerCase("en");
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => sort === "most-roles"
    ? b.roles.length - a.roles.length || a.name.localeCompare(b.name)
    : a.name.localeCompare(b.name));
}
