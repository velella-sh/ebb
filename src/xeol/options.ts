/**
 * Mapping for xeol CLI options (lookahead and failure options) and exit codes.
 */

export const XEOL_EXIT_CLEAN = 0;
export const XEOL_EXIT_EOL_FOUND = 1;
export const XEOL_EXIT_INVALID_INPUT = 1;

export interface LookaheadResult {
  asOf?: string;
  windowDays?: number;
}

/**
 * Maps xeol's lookahead option (e.g. 'none', '1d', '1w', '1m', '1y')
 * to an Ebb evaluation date (`asOf`) and window in days.
 *
 * @param lookahead - Duration string, e.g. "1y", "3m", "2w", "30d", or "none"
 * @param baseDate - Reference date (default: today UTC)
 */
export function mapLookahead(lookahead?: string, baseDate?: Date | string): LookaheadResult {
  if (lookahead === undefined || lookahead === "") {
    return {};
  }

  const base = baseDate instanceof Date ? baseDate : typeof baseDate === "string" ? new Date(baseDate) : new Date();

  if (Number.isNaN(base.getTime())) {
    throw new Error(`Invalid base date provided for lookahead: '${baseDate}'`);
  }

  const trimmed = lookahead.trim().toLowerCase();
  if (trimmed === "none") {
    const asOf = base.toISOString().slice(0, 10);
    return { asOf, windowDays: 0 };
  }

  const match = trimmed.match(/^(\d+)([dwmy])$/);
  if (!match) {
    throw new Error(`bad --lookahead value: '${lookahead}'`);
  }

  const amount = Number.parseInt(match[1]!, 10);
  const unit = match[2]!;

  let days = 0;
  if (unit === "d") {
    days = amount;
  } else if (unit === "w") {
    days = amount * 7;
  } else if (unit === "m") {
    days = amount * 30;
  } else if (unit === "y") {
    days = amount * 365;
  }

  const target = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  const asOf = target.toISOString().slice(0, 10);

  return {
    asOf,
    windowDays: days,
  };
}

/**
 * Maps xeol's `--fail-on-eol-found` flag to Ebb's `--fail-on` status threshold.
 */
export function mapFailOption(failOnEolFound?: boolean): "end-of-life" | undefined {
  return failOnEolFound ? "end-of-life" : undefined;
}

/**
 * Computes the xeol-compatible process exit code based on evaluation outcome and flags.
 */
export function determineExitCode(options: {
  hasEol?: boolean;
  failOnEolFound?: boolean;
  isInvalid?: boolean;
}): number {
  if (options.isInvalid) {
    return XEOL_EXIT_INVALID_INPUT;
  }
  if (options.hasEol && options.failOnEolFound) {
    return XEOL_EXIT_EOL_FOUND;
  }
  return XEOL_EXIT_CLEAN;
}
