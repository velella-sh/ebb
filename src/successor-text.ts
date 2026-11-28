import { parsePurl, purlIdentity } from "./purl.js";

export const successorKinds = [
  "installable-package",
  "same-component-line",
  "api-version",
  "product",
  "no-target",
  "needs-review",
] as const;
export type SuccessorKind = (typeof successorKinds)[number];

export function classifySuccessor(purl: string, replacement: string): SuccessorKind {
  let component;
  try {
    component = parsePurl(purl);
  } catch {
    return "needs-review";
  }
  if (
    /^(?:none|n\/a|no (?:supported |direct |known )?(?:replacement|successor|alternative|major|version)\b)/iu.test(
      replacement,
    )
  )
    return "no-target";
  if (/\b(?:apiVersion\s*[:=]|(?:[a-z][\w.-]*\.[a-z][\w.-]*)\/v\d+(?:[a-z]+\d+)?)\b/iu.test(replacement))
    return "api-version";
  const target = replacement.match(/\bpkg:[^\s`'",<>]+/u)?.[0];
  if (target) {
    try {
      const parsed = parsePurl(target);
      if (parsed.version && purlIdentity(parsed) === purlIdentity(component)) return "same-component-line";
      return parsed.type === "generic" ? "product" : "installable-package";
    } catch {
      return "needs-review";
    }
  }
  if (
    /^(?:npm|pnpm|yarn|bun|pip3?|cargo|go|dotnet)\s+(?:install|add|get)\s+\S/iu.test(replacement) ||
    /^@[a-z\d._-]+\/[a-z\d._-]+(?:@[\w.*-]+)?$/iu.test(replacement) ||
    ((component.type === "npm" || component.type === "pypi") && /^[a-z\d][a-z\d._-]*$/u.test(replacement))
  )
    return "installable-package";

  const name = component.name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (
    new RegExp(`^(?:upgrade to |use )?${name}(?:[ .-]+|(?=\\d))(?:v|version )?\\d+(?:\\b|\\.x)`, "iu").test(replacement)
  )
    return "same-component-line";
  if (
    /^(?:migrate|switch|move) to (?:the )?[A-Z][\w.-]+(?: [A-Za-z][\w.-]+){0,4}(?: service| product| platform)\.?$/iu.test(
      replacement,
    )
  )
    return "product";
  return "needs-review";
}
