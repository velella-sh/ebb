import { existsSync, readFileSync, writeFileSync } from "node:fs";

export { deriveRuleSlug } from "../../src/site-routes.js";

export interface SlugLockFile {
  slugs: Record<string, string>;
  redirects?: Record<string, string> | undefined;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Derive a URL-safe slug for a component from its ecosystem and name.
 * Handles scoped packages cleanly (e.g. npm + @angular/core -> npm-angular-core).
 */
export function deriveComponentSlug(ecosystem: string, name: string): string {
  const cleanName = name.replace(/^@/, "").replace(/\//g, "-");
  return slugify(`${ecosystem}-${cleanName}`);
}

/**
 * Derive a URL-safe slug for a release line from the component slug and line ID.
 */
export function deriveLineSlug(componentSlug: string, lineId: string): string {
  const linePart = lineId === "*" ? "all" : slugify(lineId);
  return `${componentSlug}-line-${linePart}`;
}

export function baseOfSlug(slug: string): string {
  return slug.replace(/-\d+$/, "");
}

export class SlugTracker {
  private lockedSlugs: Map<string, string> = new Map();
  private lockRedirects: Map<string, string> = new Map();
  private assignedSlugs: Map<string, string> = new Map(); // recordId -> slug
  private usedSlugs: Set<string> = new Set();
  private activeRedirects: Map<string, string> = new Map(); // oldSlug -> newSlug

  constructor(lockData?: SlugLockFile | null) {
    if (lockData) {
      if (lockData.slugs) {
        for (const [id, slug] of Object.entries(lockData.slugs)) {
          this.lockedSlugs.set(id, slug);
        }
      }
      if (lockData.redirects) {
        for (const [fromSlug, toSlug] of Object.entries(lockData.redirects)) {
          this.lockRedirects.set(fromSlug, toSlug);
          this.activeRedirects.set(fromSlug, toSlug);
        }
      }
    }
  }

  static fromFile(path: string): SlugTracker {
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf8");
        const parsed = JSON.parse(raw) as SlugLockFile;
        return new SlugTracker(parsed);
      } catch {
        return new SlugTracker();
      }
    }
    return new SlugTracker();
  }

  /**
   * Allocate and return a unique, locked slug for a record.
   * Throws if a previously locked slug changed without a registered redirect entry.
   */
  allocate(recordId: string, baseSlug: string): string {
    const existing = this.assignedSlugs.get(recordId);
    if (existing) {
      return existing;
    }

    const locked = this.lockedSlugs.get(recordId);
    let targetSlug = baseSlug;

    if (locked !== undefined) {
      if (locked === baseSlug || baseOfSlug(locked) === baseSlug) {
        targetSlug = locked;
      } else {
        const allowedRedirect = this.lockRedirects.get(locked);
        if (
          allowedRedirect !== undefined &&
          (allowedRedirect === baseSlug || baseOfSlug(allowedRedirect) === baseSlug)
        ) {
          // Allowed rename: register the redirect
          targetSlug = allowedRedirect;
          this.activeRedirects.set(locked, targetSlug);
        } else {
          throw new Error(
            `Slug for record "${recordId}" changed from "${locked}" to "${baseSlug}" without a redirect entry in slugs.lock.json`,
          );
        }
      }
    }

    // Collision disambiguation if targetSlug is already in use by another record
    let candidate = targetSlug;
    let counter = 2;
    while (this.usedSlugs.has(candidate)) {
      candidate = `${targetSlug}-${counter}`;
      counter++;
    }

    this.usedSlugs.add(candidate);
    this.assignedSlugs.set(recordId, candidate);
    return candidate;
  }

  getSlug(recordId: string): string | undefined {
    return this.assignedSlugs.get(recordId);
  }

  getRedirects(): Record<string, string> {
    const sorted: Record<string, string> = {};
    for (const key of Array.from(this.activeRedirects.keys()).sort()) {
      sorted[key] = this.activeRedirects.get(key)!;
    }
    return sorted;
  }

  toLockFile(): SlugLockFile {
    const slugs: Record<string, string> = {};
    for (const key of Array.from(this.assignedSlugs.keys()).sort()) {
      slugs[key] = this.assignedSlugs.get(key)!;
    }
    const redirects = this.getRedirects();
    return {
      slugs,
      ...(Object.keys(redirects).length > 0 ? { redirects } : {}),
    };
  }

  saveToFile(path: string): void {
    const lockData = this.toLockFile();
    writeFileSync(path, JSON.stringify(lockData, null, 2) + "\n", "utf8");
  }
}
