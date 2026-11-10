const PARTICLES = new Set([
  "de", "da", "do", "dos", "das", "e", "di", "du", "del", "della",
  "van", "von", "y", "la", "le", "los", "las",
]);

/** Nome próprio com pelo menos um sobrenome. Partículas não contam como sobrenome. */
export function isCompletePersonName(name?: string | null): boolean {
  const normalized = (name ?? "").trim().replace(/\s+/g, " ");
  if (!/^[\p{L}\p{M}][\p{L}\p{M}'’\-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'’\-]*)+$/u.test(normalized)) {
    return false;
  }

  let significant = 0;
  for (const token of normalized.split(" ")) {
    if (PARTICLES.has(token.toLocaleLowerCase())) continue;
    const letters = token.replace(/[^\p{L}\p{M}]/gu, "");
    if ([...letters].length < 2) return false;
    significant += 1;
  }

  return significant >= 2;
}
