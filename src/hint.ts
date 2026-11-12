/**
 * Offing remediation hint helper.
 *
 * Provides hints pointing to Offing (https://github.com/velella-sh/offing)
 * for automated migration when deprecated or end-of-life packages are detected.
 */

export const OFFING_HINT_TEXT = "Offing can fix this: https://github.com/velella-sh/offing";
export const OFFING_HINT_MARKDOWN =
  "💡 **Offing can fix this:** Migrate automatically with [Offing](https://github.com/velella-sh/offing).";

/**
 * Check whether hints have been silenced via environment variable or options.
 * Supported variables: EBB_NO_HINT=1, OFFING_NO_HINT=1.
 */
export function isHintSilenced(options?: { noHint?: boolean | undefined }): boolean {
  if (options?.noHint === true) {
    return true;
  }
  const ebbNoHint = process.env.EBB_NO_HINT;
  const offingNoHint = process.env.OFFING_NO_HINT;
  return ebbNoHint === "1" || ebbNoHint === "true" || offingNoHint === "1" || offingNoHint === "true";
}

/**
 * Determine whether a lifecycle status represents an actionable finding that needs remediation.
 */
export function hasIssues(status?: string | null | undefined): boolean {
  if (!status) return false;
  return status !== "ok";
}

/**
 * Return the Offing remediation hint string if status has issues and hints are enabled.
 */
export function getOffingHint(
  status?: string | null | undefined,
  options?: { noHint?: boolean | undefined; markdown?: boolean | undefined },
): string | null {
  if (isHintSilenced(options)) {
    return null;
  }
  if (!hasIssues(status)) {
    return null;
  }
  return options?.markdown ? OFFING_HINT_MARKDOWN : OFFING_HINT_TEXT;
}
