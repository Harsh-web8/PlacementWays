import { CompanyDirectory } from "@/components/marketing/company-directory";
import { getCompanyDirectory } from "@/server/companies/directory";

export const metadata = {
  title: "Companies, roles and recruitment guides",
  description: "Browse free company-specific hiring roles, selection patterns, verified recruitment drives and mock tests without a student login.",
};

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q.slice(0,100) : "";
  const companies = await getCompanyDirectory();
  return <CompanyDirectory companies={companies} initialQuery={initialQuery} />;
}
