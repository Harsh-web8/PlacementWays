export const learningFaults = { courses: false };
// Deliberately synthetic. Verifies HTTP/form wiring, not PostgreSQL RLS.
export const courseId = "82000000-0000-4000-8000-000000000001";
export const moduleId = "83000000-0000-4000-8000-000000000001";
export const lessonId = "84000000-0000-4000-8000-000000000001";
const companyId = "85000000-0000-4000-8000-000000000001";
const company = {
  id: companyId,
  name: "Fixture Company",
  status: "published",
  slug: "fixture-company",
  description: "Synthetic company description",
  website_url: null,
};
const course = {
  id: courseId,
  title: "Fixture foundations",
  slug: "fixture-foundations",
  description: "Synthetic course",
  difficulty: "easy",
  is_free: true,
  price_paise: 0,
  currency: "INR",
  company_id: companyId,
  category_id: null,
  mock_test_id: null,
  thumbnail_url: null,
  status: "published",
};
const lesson = {
  id: lessonId,
  module_id: moduleId,
  title: "Fixture percentages",
  slug: "fixture-percentages",
  duration_minutes: 10,
  sort_order: 0,
  is_free: false,
  status: "published",
  category_id: null,
};
const courseModule = {
  id: moduleId,
  course_id: courseId,
  title: "Fixture aptitude",
  description: "Synthetic module",
  sort_order: 0,
  status: "published",
  lessons: [lesson],
};
const enrolled = new Set(),
  completed = new Set();
export function learningRequest({ req, url, user, body, json, calls }) {
  const table = url.pathname.split("/").pop();
  if (table === "courses" && learningFaults.courses) {
    json(503, { code: "fixture_unavailable", message: "Synthetic course outage" });
    return true;
  }
  const matches = (row) =>
    [
      "id",
      "slug",
      "company_id",
      "course_id",
      "module_id",
      "lesson_id",
      "status",
    ].every(
      (k) =>
        !url.searchParams.has(k) || url.searchParams.get(k) === `eq.${row[k]}`,
    );
  const respond = (rows) => {
    rows = rows.filter(matches);
    if (req.headers.accept?.includes("application/vnd.pgrst.object+json"))
      json(200, rows[0] ?? null);
    else
      json(200, rows, {
        "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
      });
    return true;
  };
  if (req.method === "GET" || req.method === "HEAD") {
    if (table === "companies") return respond([company]);
    if (
      table === "recruitment_processes" ||
      table === "published_mock_tests" ||
      table === "categories" ||
      table === "mock_tests"
    )
      return respond([]);
    if (table === "courses") return respond([course]);
    if (table === "course_modules") return respond([courseModule]);
    if (table === "lessons") return respond([lesson]);
    if (table === "lesson_contents")
      return respond([
        {
          lesson_id: lessonId,
          body: "Fixture worked example: 20% of 150 is 30.",
          video_url: null,
          resource_url: null,
        },
      ]);
    if (table === "course_progress")
      return respond(
        user && enrolled.has(user.id)
          ? [
              {
                user_id: user.id,
                course_id: courseId,
                started_at: new Date().toISOString(),
                courses: course,
              },
            ]
          : [],
      );
    if (table === "lesson_progress")
      return respond(
        user && completed.has(user.id)
          ? [{ user_id: user.id, lesson_id: lessonId }]
          : [],
      );
  }
  if (table === "courses" && ["POST", "PATCH"].includes(req.method)) {
    calls.push(`COURSE_WRITE ${JSON.stringify(body)}`);
    if (!user || user.profile.role !== "admin") {
      json(403, { code: "42501" });
      return true;
    }
    json(200, { id: courseId });
    return true;
  }
  if (table === "start_course" || table === "complete_lesson") {
    calls.push(`LEARNING_RPC ${table} ${JSON.stringify(body)}`);
    if (!user) {
      json(403, { code: "42501" });
      return true;
    }
    enrolled.add(user.id);
    if (table === "complete_lesson") completed.add(user.id);
    json(200, null);
    return true;
  }
  return false;
}
