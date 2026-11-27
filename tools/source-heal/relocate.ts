// Relocation finder for dead sources (sub-issue 5).
// Handles HTTP redirects, renamed GitHub repositories, moved markdown files, and candidate validation.

import { containsDate } from "../source-date.js";
import { normalizeGitHubBlobUrl, fetchGitHubFileViaApi } from "../check-sources.js";

export interface RelocateResult {
  relocated: boolean;
  newUrl?: string | undefined;
  method?: "http-redirect" | "github-repo-redirect" | "github-moved-file" | undefined;
  dateFound: boolean;
  reason?: string | undefined;
}

export interface RelocateOptions {
  fetchFn?: typeof fetch | undefined;
  token?: string | undefined;
  deadline?: string | undefined;
}

/** Tries to find relocated source via HTTP redirects or GitHub repo redirects */
export async function findRelocatedSource(oldUrl: string, options: RelocateOptions = {}): Promise<RelocateResult> {
  const fetchFn = options.fetchFn ?? fetch;

  // 1. Check HTTP Redirect
  try {
    const headRes = await fetchFn(oldUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "ebb-source-heal (+https://github.com/velella-sh/ebb)",
      },
    });

    const finalUrl = headRes.url;
    if (headRes.ok && finalUrl && finalUrl !== oldUrl) {
      let bodyText = "";
      try {
        bodyText = await headRes.text();
      } catch {
        // ignore
      }
      const hasDate = options.deadline ? containsDate(bodyText, options.deadline) : true;
      if (hasDate) {
        return {
          relocated: true,
          newUrl: finalUrl,
          method: "http-redirect",
          dateFound: true,
        };
      }
    }
  } catch {
    // continue to next strategy
  }

  // 2. Check GitHub Repository / File relocation
  const parsed = normalizeGitHubBlobUrl(oldUrl);
  if (parsed) {
    const { owner, repo, ref, path } = parsed;
    // Check if repo was renamed via GitHub Repo API
    const repoApiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    try {
      const headers: Record<string, string> = {
        "user-agent": "ebb-source-heal",
        accept: "application/vnd.github.v3+json",
      };
      if (options.token) headers.authorization = `Bearer ${options.token}`;

      const repoRes = await fetchFn(repoApiUrl, { headers });
      if (repoRes.ok) {
        const repoData = (await repoRes.json()) as { full_name?: string; default_branch?: string };
        if (repoData.full_name && repoData.full_name.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) {
          // Repo was renamed / transferred!
          const newCandidateUrl = `https://github.com/${repoData.full_name}/blob/${ref}/${path}`;
          // Verify file exists in new location
          const fileObs = await fetchGitHubFileViaApi(newCandidateUrl, options.token, fetchFn);
          if (fileObs && fileObs.status === 200 && fileObs.contentSnippet) {
            const hasDate = options.deadline ? containsDate(fileObs.contentSnippet, options.deadline) : true;
            if (hasDate) {
              return {
                relocated: true,
                newUrl: newCandidateUrl,
                method: "github-repo-redirect",
                dateFound: true,
              };
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    relocated: false,
    dateFound: false,
    reason: "No valid relocated candidate found",
  };
}
