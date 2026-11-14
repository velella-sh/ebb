/**
 * Sources without the retrieval date or archive metadata the runner stamps. Importer tests compare the evidence an importer
 * produces with a committed rule; the run date and archive snapshots are maintainer governance steps, not the importer's,
 * so they are not part of that comparison.
 */
export function withoutAccessDates<T extends { accessedAt?: string; archiveUrl?: string; archivedAt?: string }>(
  sources: readonly T[],
): Array<Omit<T, "accessedAt" | "archiveUrl" | "archivedAt">> {
  return sources.map(
    ({ accessedAt: _accessedAt, archiveUrl: _archiveUrl, archivedAt: _archivedAt, ...source }) => source,
  );
}
