import type { VersionScheme } from "../vers.js";
import { VersError } from "./errors.js";
import { gemScheme } from "./gem.js";
import { mavenScheme } from "./maven.js";
import { nugetScheme } from "./nuget.js";
import { pep440Scheme } from "./pep440.js";
import { semverScheme } from "./semver.js";

/** The spec's `intdot` scheme: dot-separated integers; anything after the first other character is ignored. */
export const intdotScheme: VersionScheme = {
  names: ["intdot"],
  compare(left, right) {
    const segments = (value: string) => {
      const prefix = /^[0-9.]*/.exec(value)?.[0] ?? "";
      if (!/^\d/.test(prefix)) throw new VersError(`Invalid intdot version "${value}".`);
      return prefix
        .split(".")
        .filter(Boolean)
        .map((segment) => BigInt(segment));
    };
    const a = segments(left);
    const b = segments(right);
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
      const difference = (a[index] ?? 0n) - (b[index] ?? 0n);
      if (difference !== 0n) return difference < 0n ? -1 : 1;
    }
    return 0;
  },
};

/** All VERS schemes supported by Ebb, keyed by canonical scheme name. */
export const SUPPORTED_SCHEMES: Readonly<Record<string, VersionScheme>> = Object.freeze({
  intdot: intdotScheme,
  semver: semverScheme,
  npm: semverScheme,
  cargo: semverScheme,
  golang: semverScheme,
  composer: semverScheme,
  pypi: pep440Scheme,
  maven: mavenScheme,
  nuget: nugetScheme,
  gem: gemScheme,
});
