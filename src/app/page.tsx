import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Code2,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { FaqSection } from "@/components/marketing/faq-section";
import { listCourses } from "@/server/learning/queries";
import { listPublishedTests } from "@/server/tests/queries";
import { CourseCard } from "@/components/learning/course-card";
import { getPublishedCompanies } from "@/server/companies/queries";

const categories = [
  {
    icon: Brain,
    title: "Aptitude & Reasoning",
    text: "Build speed and accuracy with focused practice.",
  },
  {
    icon: BookOpen,
    title: "Verbal Ability",
    text: "Improve grammar, vocabulary, and comprehension.",
  },
  {
    icon: Code2,
    title: "Coding & Debugging",
    text: "Practice Java, logic building, SQL, and debugging.",
  },
  {
    icon: Target,
    title: "Core CS & Interviews",
    text: "Prepare for OOP, DBMS, OS, and technical rounds.",
  },
];

export default async function Home() {
  const [companyResult, courseResult, testResult] = await Promise.allSettled([
    getPublishedCompanies(),
    listCourses(),
    listPublishedTests({ sort: "newest", page: 1 }),
  ]);
  const companies = companyResult.status === "fulfilled" ? companyResult.value : [];
  const courses = courseResult.status === "fulfilled" ? courseResult.value.courses : [];
  const tests = testResult.status === "fulfilled" ? testResult.value.tests : [];
  for (const [section, result] of [["companies", companyResult], ["courses", courseResult], ["tests", testResult]] as const) {
    if (result.status === "rejected") console.error(`[home] Could not load ${section}`);
  }

  return (
    <main className="flex-1">
      <SiteHeader />

      <section id="top" className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold">
              <Sparkles size={14} className="text-[var(--color-accent)]" />{" "}
              Built for placement preparation
            </div>
            <h1 className="max-w-3xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Your placement preparation,{" "}
              <span className="italic text-[var(--color-accent)]">
                in one place.
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-[var(--color-ink)]/70 sm:text-lg">
              Prepare with company-specific mock tests, structured recruitment
              information, coding practice, and performance insights designed
              for Indian college students.
            </p>
            <form
              action="/courses"
              role="search"
              className="mt-7 flex flex-wrap gap-3"
            >
              <label className="sr-only" htmlFor="home-search">
                Search courses
              </label>
              <input
                id="home-search"
                name="q"
                maxLength={100}
                placeholder="What would you like to learn?"
                className="min-w-0 flex-1 rounded border border-[var(--color-line)] bg-white/40 px-4 py-3"
              />
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button variant="accent" size="lg" asChild>
                <Link href="/register">
                  Start practicing <ArrowRight size={17} />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/tests">Try a free mock test</Link>
              </Button>
            </div>
            {companies.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-[var(--color-ink)]/60">Popular:</span>
                {companies.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    href={`/companies/${c.slug}`}
                    className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 hover:border-[var(--color-ink)]/50"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-[var(--color-ink)]/65">
              <span className="flex items-center gap-2">
                <CheckCircle2
                  size={16}
                  className="text-[var(--color-success)]"
                />{" "}
                Company-focused
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2
                  size={16}
                  className="text-[var(--color-success)]"
                />{" "}
                Practice-first
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2
                  size={16}
                  className="text-[var(--color-success)]"
                />{" "}
                Built for freshers
              </span>
            </div>
          </div>
          <div className="relative rounded-3xl border border-[var(--color-line)] bg-[var(--color-ink)] p-6 text-[var(--color-paper)] shadow-xl sm:p-8">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>YOUR PREPARATION HUB</span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                Learn · Practice · Improve
              </span>
            </div>
            <div className="mt-10">
              <p className="text-sm text-white/60">Today&apos;s focus</p>
              <h2 className="mt-2 font-serif text-4xl">Build consistency.</h2>
              <p className="mt-4 text-sm leading-6 text-white/65">
                Practice a little every day. Track weak topics. Return stronger.
              </p>
            </div>
            <ol className="mt-8 space-y-3">
              {[
                {
                  title: "Learn a concept",
                  text: "Follow a course and work through its lessons.",
                },
                {
                  title: "Put it into practice",
                  text: "Attempt a mock test and review the explanations.",
                },
                {
                  title: "Keep moving forward",
                  text: "Save completed lessons and return to your dashboard.",
                },
              ].map((step, i) => (
                <li key={step.title} className="rounded-2xl bg-white/10 p-4">
                  <p className="font-medium">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-2 text-sm text-white/65">{step.text}</p>
                </li>
              ))}
            </ol>
            <Link
              href="/courses"
              className="mt-6 inline-block text-sm text-[var(--color-accent)] underline"
            >
              Explore learning paths
            </Link>
          </div>
        </div>
      </section>

      <section
        id="companies"
        className="border-y border-[var(--color-line)] bg-white/35"
      >
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-accent)]">
                Start with your target
              </p>
              <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
                Prepare by company.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--color-ink)]/65">
              Explore focused preparation paths for the companies students
              commonly target.
            </p>
          </div>

          {companies.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-dashed border-[var(--color-line)] p-8 text-sm text-[var(--color-ink)]/60">
              Company preparation paths are being added. Check back soon.
            </p>
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {companies.map((company) => (
                <article
                  key={company.id}
                  className="group rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 transition-transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-end">
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </div>
                  <h3 className="mt-8 font-serif text-3xl">{company.name}</h3>
                  {company.description && (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--color-ink)]/65">
                      {company.description}
                    </p>
                  )}
                  <Link
                    href={`/companies/${company.slug}`}
                    className="mt-6 inline-block text-sm font-semibold underline decoration-[var(--color-accent)] underline-offset-4"
                  >
                    View preparation path
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="practice">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-accent)]">
              Practice that compounds
            </p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
              Everything you need to prepare with direction.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="rounded-2xl border border-[var(--color-line)] p-6"
              >
                <Icon size={25} className="text-[var(--color-accent)]" />
                <h3 className="mt-8 font-serif text-2xl">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--color-ink)]/65">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="bg-[var(--color-ink)] text-[var(--color-paper)]"
      >
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-accent)]">
                Simple workflow
              </p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl">
                A better way to practice.
              </h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              {[
                {
                  n: "01",
                  title: "Choose",
                  text: "Select your target company and preparation area.",
                },
                {
                  n: "02",
                  title: "Practice",
                  text: "Attempt focused tests and learn from explanations.",
                },
                {
                  n: "03",
                  title: "Improve",
                  text: "Review your performance and repeat weak topics.",
                },
              ].map((step) => (
                <div key={step.n} className="border-t border-white/20 pt-4">
                  <span className="text-sm text-[var(--color-accent)]">
                    {step.n}
                  </span>
                  <h3 className="mt-6 font-serif text-2xl">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-8 px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-serif text-4xl">Start learning</h2>
          <Link href="/courses" className="underline">
            All courses
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.slice(0, 3).map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
        {!courses.length && (
          <p>
            Courses are being prepared. Explore our company guides while new
            lessons are added.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-serif text-4xl">Test your progress</h2>
          <Link href="/tests" className="underline">
            All mock tests
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {tests.slice(0, 3).map((t) => (
            <article key={t.id} className="rounded-xl border p-6">
              <h3 className="font-serif text-2xl">
                <Link className="underline" href={`/tests/${t.slug}`}>
                  {t.title}
                </Link>
              </h3>
              <p className="mt-3">
                {t.durationMinutes} minutes · {t.questionCount} questions
              </p>
            </article>
          ))}
        </div>
        {!tests.length && <p>Published mock tests will appear here.</p>}
      </section>
      <FaqSection />

      <SiteFooter />
    </main>
  );
}
