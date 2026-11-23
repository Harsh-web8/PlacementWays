"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, BriefcaseBusiness, Search, SlidersHorizontal, X } from "lucide-react";
import { filterCompanyDirectory, type CompanyDirectoryFilter, type CompanyDirectorySort, type DirectoryCompany } from "@/lib/company-directory";

const filters: Array<{ value: CompanyDirectoryFilter; label: string }> = [
  { value: "all", label: "All companies" },
  { value: "with-roles", label: "With role guides" },
  { value: "with-drives", label: "With hiring drives" },
];

export function CompanyDirectory({ companies, initialQuery }: { companies: DirectoryCompany[]; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<CompanyDirectoryFilter>("all");
  const [sort, setSort] = useState<CompanyDirectorySort>("name");
  const visible = useMemo(() => filterCompanyDirectory(companies, deferredQuery, filter, sort), [companies, deferredQuery, filter, sort]);
  const roleCount = companies.reduce((n, company) => n + company.roles.length, 0);
  const driveCount = companies.reduce((n, company) => n + company.publishedDriveCount, 0);
  return <>
    <section className="bg-[var(--color-ink)] text-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.17em] text-[var(--color-accent)]">The company directory</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">One company. Every recruitment step.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">Explore hiring roles, drive-specific selection rounds, test patterns and practice resources. Free access, no student account required.</p>
        </div>
        <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 text-center sm:text-left">
          {[{value:companies.length,label:"Published companies"},{value:roleCount,label:"Role guides"},{value:driveCount,label:"Hiring drives"}].map(stat=><div key={stat.label} className="rounded-xl border border-white/15 bg-white/10 p-3 sm:p-4"><p className="text-2xl font-semibold tabular-nums sm:text-3xl">{stat.value}</p><p className="mt-1 text-xs leading-5 text-white/65">{stat.label}</p></div>)}
        </div>
        <div className="relative mt-8 max-w-2xl">
          <label htmlFor="directory-search" className="sr-only">Search by company or job role</label>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-ink)]/45" />
          <input id="directory-search" type="search" value={query} onChange={e=>setQuery(e.target.value.slice(0,100))} maxLength={100} placeholder="Search company or role, e.g. software engineer" autoComplete="off" className="h-14 w-full rounded-xl border border-white/30 bg-white pl-12 pr-4 text-base text-[var(--color-ink)] shadow-lg placeholder:text-[var(--color-ink)]/45 focus-visible:outline-offset-2" />
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8" aria-label="Company results">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--color-line)] pb-6 lg:flex-row lg:items-center">
        <div className="space-y-1"><h2 className="font-serif text-2xl">Browse companies</h2><p role="status" aria-live="polite" className="text-sm text-[var(--color-ink)]/65">{visible.length} of {companies.length} published companies</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter companies">
            {filters.map(item=><button key={item.value} type="button" aria-pressed={filter===item.value} onClick={()=>setFilter(item.value)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition sm:text-sm ${filter===item.value?"border-[var(--color-ink)] bg-[var(--color-ink)] text-white":"border-[var(--color-line)] bg-white hover:border-[var(--color-ink)]/50"}`}>{item.label}</button>)}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--color-ink)]/70"><SlidersHorizontal size={15} aria-hidden/><span className="sr-only">Sort companies</span><select value={sort} onChange={e=>setSort(e.target.value as CompanyDirectorySort)} className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)]"><option value="name">Name A–Z</option><option value="most-roles">Most role guides</option></select></label>
        </div>
      </div>
      {visible.length ? <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(company=><article key={company.id} className="group flex flex-col rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-ink)]/40 hover:shadow-lg focus-within:ring-2 focus-within:ring-[var(--color-ink)]/20">
        <div className="flex items-start gap-3"><div aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-ink)] font-serif text-xl font-semibold text-white">{company.name.charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><h3 className="font-serif text-xl leading-tight"><Link href={`/companies/${company.slug}`} className="after:absolute after:inset-0 relative group-hover:underline decoration-[var(--color-accent)] underline-offset-4">{company.name}</Link></h3><div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-ink)]/65"><span className="inline-flex items-center gap-1"><BriefcaseBusiness size={13} aria-hidden/> {company.roles.length} roles</span><span>·</span><span>{company.publishedDriveCount} drives</span></div></div></div>
        <p className="mt-5 line-clamp-3 min-h-[4rem] text-sm leading-6 text-[var(--color-ink)]/70">{company.description || "Explore the published recruitment and preparation information for this company."}</p>
        <div className="mt-4 flex flex-wrap gap-2">{company.roles.slice(0,3).map(role=><Link key={role.slug} href={`/companies/${company.slug}/roles/${role.slug}`} className="relative z-10 max-w-full truncate rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-xs hover:border-[var(--color-ink)]/60" title={role.title}>{role.title}</Link>)}{company.roles.length>3&&<span className="rounded-full border px-2 py-1.5 text-xs">+{company.roles.length-3} more</span>}{company.roles.length===0&&<span className="text-xs text-[var(--color-ink)]/50">Role guides coming after verification</span>}</div>
        <div className="mt-auto flex items-center justify-between border-t border-[var(--color-line)] pt-5 text-sm font-semibold"><span className="inline-flex items-center gap-2"><Building2 size={15} aria-hidden/> Company guide</span><ArrowRight size={17} aria-hidden className="transition-transform group-hover:translate-x-1" /></div>
      </article>)}</div>:<div className="mt-8 rounded-2xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center"><Search className="mx-auto h-8 w-8 text-[var(--color-ink)]/45" aria-hidden/><h3 className="mt-4 font-serif text-2xl">No matching companies</h3><p className="mt-2 text-sm text-[var(--color-ink)]/65">Try a shorter company or role name, or reset the filters.</p><button type="button" onClick={()=>{setQuery("");setFilter("all");setSort("name");}} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white"><X size={15}/> Clear filters</button></div>}
      <p className="mt-8 text-xs leading-6 text-[var(--color-ink)]/60">Patterns and recruitment availability depend on the hiring drive. Always confirm applications and eligibility through linked official sources. Unverified details remain labeled as such.</p>
    </section>
  </>;
}
