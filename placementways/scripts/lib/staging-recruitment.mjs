export const RECRUITMENT_FIXTURE = Object.freeze({
  company: "dd100000-0000-4000-8000-000000000001",
  role: "dd100000-0000-4000-8000-000000000002",
  drive: "dd100000-0000-4000-8000-000000000003",
  round: "dd100000-0000-4000-8000-000000000004",
  before: 20,
  after: 35,
  quote: "Synthetic acceptance round lasts 35 minutes.",
});

export function recruitmentPhaseChecks(phase, { proposal, fields, publicRound, publicUpdate, history, audit }) {
  const fixture = RECRUITMENT_FIXTURE;
  const patch = fields.find(field =>
    field.target_kind === "round" && field.target_id === fixture.round && field.field_key === "duration_minutes");
  const scoped = proposal?.company_id === fixture.company && proposal?.role_id === fixture.role && proposal?.drive_id === fixture.drive;
  const published = phase === "approved";
  const rolledBack = phase === "rolled-back";
  return [
    ["Proposal belongs to the staging fixture", scoped],
    ["Extracted change matches the captured notice", Boolean(
      patch?.old_value === fixture.before && patch.new_value === fixture.after &&
      patch.evidence_quote.includes(fixture.quote.replace(/\.$/, "")) &&
      proposal?.observed_excerpt?.includes(patch.evidence_quote))],
    ["Proposal has the expected editorial status", proposal?.status === (phase === "pending" ? "pending" : "approved")],
    ["Anonymous round has the expected duration", publicRound?.duration_minutes === (published ? fixture.after : fixture.before)],
    ["Anonymous update visibility matches the phase", published ? publicUpdate?.is_current === true : publicUpdate === null],
    ["Publication history matches the phase", phase === "pending" ? history === null : history?.is_current === published],
    ["Admin decision audit matches the phase", phase === "pending" ? audit.length === 0 :
      audit.includes("recruitment.approve_structured") && audit.includes("recruitment.rollback") === rolledBack],
  ];
}
