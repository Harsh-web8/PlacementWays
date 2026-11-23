// Synthetic Data API responses for the anonymous launch paths.
export const codingPath = "/questions/fixture-coding";
export const mockPath = "/tests/fixture-mock";
export const submissionPath = "/coding/submissions/21000000-0000-4000-8000-000000000001";
export const attemptPath = "/attempts/21000000-0000-4000-8000-000000000002";
export const serviceKey = "local-fixture-server-key".repeat(2);
const questionId = "21000000-0000-4000-8000-000000000003";
const categoryId = "21000000-0000-4000-8000-000000000004";
const testId = "21000000-0000-4000-8000-000000000005";
const companyId = "85000000-0000-4000-8000-000000000001";
const roleId = "21000000-0000-4000-8000-000000000006";
const driveId = "21000000-0000-4000-8000-000000000007";
const codingQuestion = {
  id: questionId, slug: "fixture-coding", text: "Print the fixture value.", type: "coding",
  difficulty: "easy", category_id: categoryId, category_name: "Fixture topic", options: [],
};
const mock = {
  id: testId, slug: "fixture-mock", title: "Fixture mock", description: "Synthetic timed mock",
  instructions: null, company_id: companyId, status: "published", difficulty: "easy",
  duration_minutes: 20, is_free: true, price_paise: 0, question_count: 1, total_marks: 1,
  attempt_count: 0, has_negative_marking: false,
};
const test = { id: testId, title: mock.title, slug: mock.slug, duration_minutes: 20, instructions: null };
const options = [{ key: "A", text: "First choice" }, { key: "B", text: "Second choice" }];
const question = { id: questionId, order: 1, type: "mcq", text: "Fixture question", marks: 1, negative_marks: 0, options };
const tables = {
  site_settings: [{ id: true, coding_enabled: true, commerce_enabled: false, announcement: null }],
  mock_tests: [mock],
  published_mock_tests: [mock],
  mock_test_categories: [],
  practice_questions: [{ ...codingQuestion, question_text: codingQuestion.text, question_type: "coding" }],
  coding_examples: [{ id: questionId, question_id: questionId, input: "", expected_output: "42" }],
  coding_languages: [{ key: "python", name: "Python", enabled: true }],
  recruitment_updates: [],
  blog_posts: [],
  company_roles: [{
    id: roleId, company_id: companyId, slug: "fixture-role", title: "Fixture role", status: "published",
    required_skills: [], description: "Synthetic role guide",
  }],
  recruitment_drives: [{
    id: driveId, role_id: roleId, title: "Fixture drive", status: "published",
    hiring_year: 2026, drive_status: "unknown",
    recruitment_rounds: [{
      id: questionId, round_number: 1, name: "Fixture round", source_kind: "unverified",
      question_count: 10, duration_minutes: 20, topics: ["Fixture topic"],
    }],
  }],
};

export function launchRequestFixture() {
  let submission;
  let attempt;
  return ({ req, url, body, json }) => {
    const table = url.pathname.split("/").pop();
    if (req.method === "GET" && Object.hasOwn(tables, table)) {
      const rows = tables[table].filter(row => [...url.searchParams].every(([key, filter]) =>
        !filter.startsWith("eq.") || String(row[key]) === filter.slice(3)));
      json(200, req.headers.accept?.includes("application/vnd.pgrst.object+json") ? rows[0] ?? null : rows,
        { "content-range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" });
      return true;
    }
    if (table === "get_practice_question") {
      json(200, body.p_slug === codingQuestion.slug ? codingQuestion : null);
      return true;
    }
    if (!["guest_mock_gateway", "start_guest_coding_submission", "get_guest_coding_submission"].includes(table)) return false;
    if (req.headers.apikey !== serviceKey) {
      json(403, { code: "42501" });
      return true;
    }
    if (table === "start_guest_coding_submission") {
      submission = { owner: body.p_guest_hash, result: {
        id: submissionPath.split("/").pop(), status: "accepted", kind: body.p_kind, passed: 1, total: 1,
        feedback: [], source_code: body.p_source, language_key: body.p_language, created_at: new Date().toISOString(),
      } };
      json(200, submission.result.id);
    } else if (table === "get_guest_coding_submission") {
      json(200, submission && submission.owner === body.p_guest_hash &&
        submission.result.id === body.p_submission_id ? submission.result : null);
    } else if (body.p_operation === "access" || body.p_operation === "start") {
      if (body.p_operation === "access") {
        json(200, { decision: "allow" });
        return true;
      }
      const id = attemptPath.split("/").pop();
      attempt = { id, owner: body.p_token_hash, started: new Date().toISOString(), selected: null, submitted: null };
      json(200, { decision: "allow", attempt_id: id });
    } else if (!attempt || body.p_token_hash !== attempt.owner || body.p_attempt_id !== attempt.id) {
      json(200, null);
    } else if (body.p_operation === "state") {
      json(200, {
        attempt: { id: attempt.id, status: attempt.submitted ? "submitted" : "in_progress", started_at: attempt.started,
          server_now: new Date().toISOString(), expires_at: new Date(Date.parse(attempt.started) + 1200000).toISOString() },
        test, questions: [question], answers: [],
      });
    } else if (body.p_operation === "save") {
      attempt.selected = body.p_selected;
      json(200, "saved");
    } else if (body.p_operation === "submit") {
      attempt.selected = body.p_answers?.[0]?.selected_answer ?? attempt.selected;
      attempt.submitted ??= new Date().toISOString();
      json(200, "submitted");
    } else if (body.p_operation === "result" && attempt.submitted) {
      const correct = Number(attempt.selected === "A");
      json(200, {
        attempt: { id: attempt.id, status: "submitted", started_at: attempt.started, submitted_at: attempt.submitted,
          score: correct, total_marks: 1, time_used_seconds: 10 },
        test, summary: { question_count: 1, correct, incorrect: 1 - correct, unanswered: 0 },
        questions: [{ ...question, difficulty: "easy", category_id: categoryId, category_name: "Fixture topic",
          explanation: "Fixture explanation", correct_answer: "A", selected_answer: attempt.selected,
          is_correct: Boolean(correct), marks_awarded: correct, marked_for_review: false }],
      });
    } else {
      json(200, null);
    }
    return true;
  };
}
