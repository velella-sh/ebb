/**
 * Ebb remediation hints for deprecation and end-of-life findings.
 */

export const EBB_REMEDIATION_HINT = "For remediation and lifecycle details, see: https://velella.sh/ebb/";
export const OFFING_REMEDIATION_HINT = "Offing can fix this: https://github.com/velella-sh/offing";

/**
 * Check whether hints have been disabled via environment variables.
 * Supported variables: EBB_NO_HINT=1 and OFFING_NO_HINT=1.
 */
export function isHintSilenced(): boolean {
  const ebbNoHint = process.env.EBB_NO_HINT;
  const offingNoHint = process.env.OFFING_NO_HINT;
  return (
    ebbNoHint === "1" ||
    ebbNoHint === "true" ||
    offingNoHint === "1" ||
    offingNoHint === "true"
  );
}

/**
 * Determine whether a given lifecycle status represents an actionable issue.
 */
export function hasIssues(status?: string | null): boolean {
  if (!status) {
    return false;
  }
  return status !== "ok";
}

/**
 * Returns the Offing remediation hint if the status requires action
 * and hints have not been silenced via environment variable.
 */
export function getOffingHint(status?: string | null): string | null {
  if (isHintSilenced()) {
    return null;
  }
  if (!hasIssues(status)) {
    return null;
  }
  return OFFING_REMEDIATION_HINT;
}
