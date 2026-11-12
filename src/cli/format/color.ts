/**
 * Zero-dependency ANSI terminal colors respecting NO_COLOR.
 * See https://no-color.org/
 */

export interface Colors {
  bold: (text: string) => string;
  dim: (text: string) => string;
  red: (text: string) => string;
  green: (text: string) => string;
  yellow: (text: string) => string;
  cyan: (text: string) => string;
  gray: (text: string) => string;
}

export function isColorSupported(options?: { color?: boolean | undefined; noColor?: boolean | undefined }): boolean {
  if (options?.noColor) return false;
  if (options?.color) return true;

  // Respect standard NO_COLOR environment variable
  const noColorEnv = process.env.NO_COLOR;
  if (noColorEnv !== undefined && noColorEnv !== "") {
    return false;
  }

  // Dumb terminals do not render ANSI
  if (process.env.TERM === "dumb") {
    return false;
  }

  // If stdout is available and is a TTY
  const isTty = Boolean(process.stdout && (process.stdout as { isTTY?: boolean }).isTTY);
  return isTty;
}

export function createColors(enabled: boolean): Colors {
  const wrap = (open: number, close: number) =>
    enabled ? (str: string) => `\x1b[${open}m${str}\x1b[${close}m` : (str: string) => str;

  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
    cyan: wrap(36, 39),
    gray: wrap(90, 39),
  };
}
