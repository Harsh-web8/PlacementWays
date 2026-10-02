import { publicMetadata } from "@/lib/seo";
import { PurchaseButton } from "@/components/billing-purchase";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCourse,
  getSyllabus,
  getLearningProgress,
} from "@/server/learning/queries";
import { getCurrentUser } from "@/server/auth/session";
import { updateLearningProgress } from "@/server/learning/actions";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/learning/action-form";
import { coursePrice } from "@/components/learning/course-card";
export default async function Course({ params }: PageProps<"/courses/[slug]">) {
  const course = await getCourse((await params).slug);
  if (!course) notFound();
  const [modules, user] = await Promise.all([
    getSyllabus(course.id),
    getCurrentUser(),
  ]);
  const progress = user ? await getLearningProgress(user.id) : null;
  const lessons = modules.flatMap((m) => m.lessons);
  const completed = lessons.filter((l) => progress?.completed.has(l.id)).length;
  const db = await createClient();
  const entitlement = user ? (await db.rpc("has_content_access", {p_course_id: course.id})).data === true : false;
  const mock = course.mock_test_id
    ? (
        await db
          .from("mock_tests")
          .select("slug,title")
          .eq("id", course.mock_test_id)
          .eq("status", "published")
          .maybeSingle()
      ).data
    : null;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-12">
      <nav aria-label="Breadcrumb">
        <Link className="underline" href="/courses">
          Courses
        </Link>{" "}
        / {course.title}
      </nav>
      <div>
        <p className="text-sm capitalize">
          {course.difficulty} · {coursePrice(course)}
        </p>
        <h1 className="mt-3 font-serif text-4xl">{course.title}</h1>
        <p className="mt-4 whitespace-pre-wrap leading-7">
          {course.description}
        </p>
      </div>
      {user && (
        <p>
          {completed} of {lessons.length} lessons completed{" "}
          {lessons.length > 0 &&
            `(${Math.round((completed / lessons.length) * 100)}%)`}
        </p>
      )}
      {course.is_free || entitlement ? (
        user ? (
          <ActionForm
            label="Start / continue course"
            action={updateLearningProgress.bind(null, "course", course.id)}
          />
        ) : (
          <Link
            className="underline"
            href={`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`}
          >
            Log in to save your progress
          </Link>
        )
      ) : (
        <div className="space-y-4 rounded border p-4"><p>
          Premium course. Access is available with a valid course entitlement. Published free previews
          are available below.
        </p><PurchaseButton kind="course" id={course.id}/></div>
      )}
      {!lessons.length && <p>Lessons are being prepared.</p>}
      {modules.map((m) => (
        <section
          key={m.id}
          className="space-y-4 rounded-xl border border-[var(--color-line)] p-6"
        >
          <h2 className="font-serif text-2xl">{m.title}</h2>
          <p>{m.description}</p>
          <ol className="divide-y">
            {m.lessons.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap justify-between gap-3 py-3"
              >
                <Link
                  href={`/courses/${course.slug}/lessons/${l.id}`}
                  className="underline"
                >
                  {l.title}
                </Link>
                <span className="text-sm">
                  {l.duration_minutes} min ·{" "}
                  {progress?.completed.has(l.id)
                    ? "Completed"
                    : course.is_free || l.is_free || entitlement
                      ? "Available"
                      : "Locked"}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {mock && (
        <Link href={`/tests/${mock.slug}`} className="inline-block underline">
          Put it into practice: {mock.title}
        </Link>
      )}
    </div>
  );
}

export async function generateMetadata({params}:PageProps<"/courses/[slug]">){const {slug}=await params;const item=await getCourse(slug);return publicMetadata(item?.title??"Course",item?.description,`/courses/${slug}`);}
