import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  getCourse,
  getSyllabus,
  getLessonBody,
  getLearningProgress,
} from "@/server/learning/queries";
import { getCurrentUser } from "@/server/auth/session";
import { updateLearningProgress } from "@/server/learning/actions";
import { ActionForm } from "@/components/learning/action-form";
export default async function Lesson({
  params,
}: PageProps<"/courses/[slug]/lessons/[lessonId]">) {
  const { slug, lessonId } = await params;
  if (!z.uuid().safeParse(lessonId).success) notFound();
  const course = await getCourse(slug);
  if (!course) notFound();
  const lessons = (await getSyllabus(course.id)).flatMap((m) => m.lessons);
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) notFound();
  const lesson = lessons[index];
  // Access is also enforced at the table level; never serialize a locked body.
  const body = await getLessonBody(lesson.id); // RLS includes paid entitlements and free previews.
  const user = await getCurrentUser();
  const completed = user
    ? (await getLearningProgress(user.id)).completed.has(lesson.id)
    : false;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-12">
      <nav aria-label="Breadcrumb">
        <Link href={`/courses/${slug}`} className="underline">
          {course.title}
        </Link>{" "}
        / {lesson.title}
      </nav>
      <h1 className="font-serif text-4xl">{lesson.title}</h1>
      <p>{lesson.duration_minutes} minutes</p>
      {body ? (
        <>
          <article className="whitespace-pre-wrap break-words text-base leading-8">
            {body.body}
          </article>
          <div className="flex flex-wrap gap-5">
            {body.video_url && (
              <a
                className="underline"
                href={body.video_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Watch lesson video
              </a>
            )}
            {body.private_resource_path && <a className="block underline" href={`/api/lessons/${lessonId}/resource`}>Download lesson PDF</a>}
            {body.resource_url && (
              <a
                className="underline"
                href={body.resource_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open lesson resource
              </a>
            )}
          </div>
          <Link className="block underline" href={`/practice?lesson=${lesson.id}`}>Practise this lesson</Link>
          {completed ? (
            <p>✓ Lesson completed</p>
          ) : user ? (
            <ActionForm
              label="Mark complete"
              action={updateLearningProgress.bind(null, "lesson", lesson.id)}
            />
          ) : (
            <Link
              className="underline"
              href={`/login?next=${encodeURIComponent(`/courses/${slug}/lessons/${lesson.id}`)}`}
            >
              Log in to save completion
            </Link>
          )}
        </>
      ) : (
        <p>
          This lesson is locked or unavailable. Free previews are listed on the
          course page.
        </p>
      )}
      <nav
        aria-label="Lessons"
        className="flex flex-wrap justify-between gap-4 border-t pt-6"
      >
        {lessons[index - 1] && (
          <Link
            className="underline"
            href={`/courses/${slug}/lessons/${lessons[index - 1].id}`}
          >
            Previous: {lessons[index - 1].title}
          </Link>
        )}
        {lessons[index + 1] && (
          <Link
            className="underline"
            href={`/courses/${slug}/lessons/${lessons[index + 1].id}`}
          >
            Next: {lessons[index + 1].title}
          </Link>
        )}
      </nav>
    </div>
  );
}
