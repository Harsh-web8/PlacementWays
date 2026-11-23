/**
 * Decides when a scan must enter the private editorial queue.
 *
 * An initial scan is a baseline, unless it extracts concrete, source-backed
 * field changes or new roles/drives for review. Importantly, a later successful
 * AI retry must be allowed to enrich the same pending fingerprint after an
 * earlier provider outage or invalid response. The caller handles idempotency
 * through the (watch_source_id, fingerprint) database uniqueness constraint.
 */
export function shouldQueueRecruitmentProposal(input: {
  sourceChanged: boolean;
  fieldChangeCount: number;
  discoveryCount: number;
}): boolean {
  return input.sourceChanged || input.fieldChangeCount > 0 || input.discoveryCount > 0;
}
