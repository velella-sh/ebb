/**
 * How Ebb writes versions that are not semver as semver text, so their rules can use the `semver` VERS scheme.
 * A consumer translates what it finds with these functions before it asks whether a rule's range contains it.
 */

const KUBERNETES_API_VERSION = /^v([1-9]\d{0,5})(?:(alpha|beta)([1-9]\d{0,5}))?$/;

/**
 * The rule version text for a Kubernetes API version: `v1` is `1.0.0`, `v1beta2` is `1.0.0-beta.2` and `v2alpha1`
 * is `2.0.0-alpha.1`. That keeps Kubernetes' maturity order (alpha, then beta, then stable) without a new VERS
 * scheme. Undefined when `version` is not a Kubernetes API version.
 */
export function kubernetesRuleVersion(version: string): string | undefined {
  const match = KUBERNETES_API_VERSION.exec(version);
  if (!match) return undefined;
  const [, major, stage, number] = match;
  return stage ? `${major}.0.0-${stage}.${number}` : `${major}.0.0`;
}

/** The rule version text for a JDK feature release: `22` is `22.0.0`. */
export function jdkRuleVersion(major: number): string {
  return `${major}.0.0`;
}
