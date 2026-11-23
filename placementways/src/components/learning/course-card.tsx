import Link from "next/link";
import { ArrowRight } from "lucide-react";
export function coursePrice(course: {
  is_free: boolean;
  price_paise: number;
  currency: string;
}) {
  return course.is_free
    ? "Free"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: course.currency,
      }).format(course.price_paise / 100);
}
export function CourseCard({
  course,
}: {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string;
    difficulty: string;
    is_free: boolean;
    price_paise: number;
    currency: string;
  };
}) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex flex-col rounded-xl border border-[var(--color-line)] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[var(--color-ink)]/40 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="rounded-full bg-[var(--color-paper)] px-2.5 py-1 capitalize ring-1 ring-[var(--color-line)]">
          {course.difficulty}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 font-semibold ${
            course.is_free ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {coursePrice(course)}
        </span>
      </div>
      <h2 className="mt-4 font-serif text-xl leading-snug">{course.title}</h2>
      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-[var(--color-ink)]/75">
        {course.description}
      </p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
        View course
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
