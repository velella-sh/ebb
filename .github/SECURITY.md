# Security Policy

## Scope and supported versions

This policy covers the [npm and JSR package](https://velella.sh/ebb/quickstart/), the [signed lifecycle data and release log](https://velella.sh/ebb/verify/), the [Ebb GitHub Action](../action/README.md), and the [static API](https://velella.sh/ebb/static-api/). Report signature bypasses and security defects privately. Use the [rule correction guide](https://velella.sh/ebb/source-heal/) for ordinary lifecycle data corrections.

| Version or service | Security fixes |
| --- | --- |
| Latest published stable `0.y.z` minor, currently `0.2.x` | Fixes ship in the next patch release, such as `0.y.(z+1)`. |
| Earlier minor versions and prereleases | Upgrade to the latest stable version. |
| Signed lifecycle data and static API | Fixes ship in the next verified snapshot or deployment. |

Check the [current npm version](https://www.npmjs.com/package/@velella/ebb) and [verification guide](https://velella.sh/ebb/verify/) for the appropriate artifact and commands.

## Report a vulnerability privately

Use GitHub's [Report a vulnerability](https://github.com/velella-sh/ebb/security/advisories/new) form. Include the affected version or signed data date, the affected component, impact, and enough details to reproduce the issue. Keep credentials and personal data out of the report.

The maintainer acknowledges and triages the report in the private thread, shares the planned next update when the impact is understood, and coordinates disclosure with the reporter after a fix or mitigation is available. Timing depends on the scope of the fix and upstream maintainers. Public disclosure uses a [GitHub security advisory](https://github.com/velella-sh/ebb/security/advisories) when appropriate.
