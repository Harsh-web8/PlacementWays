import Link from "next/link";
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
    <article className="flex flex-col rounded-xl border border-[var(--color-line)] bg-white/40 p-6">
      <p className="text-sm capitalize">
        {course.difficulty} · {coursePrice(course)}
      </p>
      <h2 className="mt-4 font-serif text-2xl">
        <Link
          className="underline underline-offset-4"
          href={`/courses/${course.slug}`}
        >
          {course.title}
        </Link>
      </h2>
      <p className="mt-3 line-clamp-4 text-sm leading-7">
        {course.description}
      </p>
    </article>
  );
}
