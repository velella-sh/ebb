---
title: Add a product
description: Draft an evidence-backed lifecycle rule and its matching cases from a checkout.
layout: doc
permalink: /add-a-product/
---

# Add a product

Find a vendor source, run the rule tool, and review the rule with its match and non-match cases. You need Git and Node.js 22 or newer. GitHub CLI is useful for opening the pull request.

## 1. Find vendor evidence

Start with the vendor's release schedule, deprecation notice or official registry entry. Record the affected versions, the event in the source's own words, and its date if one is given. The [Python Developer's Guide](https://devguide.python.org/versions/#unsupported-versions), for example, identifies Python 3.8 as end-of-life on 2024-10-07.

If the source says only that support ends in October, leave the day unspecified. If the event or affected versions are unclear, ask for help through the [new product issue form](https://github.com/velella-sh/ebb/issues/new?template=new-product.yml). Include a product name, a Package URL or an explanation if one does not exist, and the official source link.

## 2. Draft the rule and cases

Use a clone of Ebb, or your fork if you need a branch you can push to.

:::terminal
$ git clone https://github.com/velella-sh/ebb.git
$ cd ebb
$ git switch -c data/python-38-end-of-life
$ npm ci
$ npm run new-rule
:::

The following is a worked rehearsal. The registry already covers Python 3.8, so keep any redundant example rule in your practice checkout.

| Prompt | Example answer |
| --- | --- |
| Unversioned package URL | `pkg:generic/python` |
| Registry ecosystem | `python` |
| Affected range | `vers:pypi/>=3.8.0\|<3.9.0` |
| Event | `end-of-life` |
| Deadline | `2024-10-07` |
| Authoritative HTTPS source URL | `https://devguide.python.org/versions/#unsupported-versions` |
| Source title | Status of Python versions |
| Date you read the source | Use the actual date you read it |
| Rule ID | `python.runtime.eol-38-example` in a disposable checkout |
| Title | Python 3.8 reached end of life |
| Summary | CPython marks Python 3.8 as end-of-life as of October 7, 2024. |
| Severity | `high` |
| GitHub handle | Your own, after you read the source |
| Version inside the range | `3.8.10` |
| Version outside the range | `3.9.18` |

Confirm only after reviewing the two versions. Reuse an affected version already listed in the case file so the tool can update its expected matches. If other existing cases also need updates, the tool reports them before it writes anything. The tool checks the rule v2 schema, repository lint, and affected cases before writing anything. It writes the registry and case files and regenerates the corresponding bundled module if one exists. Keep the existing precedence of neighboring rules. The [rule reference](/rules/) describes the full format and its evidence requirements.

## 3. Open the pull request

Review `git diff` and run `npm run lint:rules` and `npm run check`. For an actual new rule, use the file list the tool printed to stage and commit only the rule, cases and generated module. Push the branch and run `gh pr create`. In the PR body, link the source and describe how it supports the range, event and date.

The evidence comment reports schema and lint results, matching cases, source reachability, whether the claimed date appeared in the source, and any archive request. A matching date is a pointer for review. The maintainer still verifies what the vendor actually says.

On a product request, triage reports whether the cited page was reachable and whether it found a possible date or lifecycle policy. A comment asking for more details means the reporter can edit the issue to supply the missing link, range or event. The workflow labels dated candidates `good first rule` for review. Triage does not write registry rules.
