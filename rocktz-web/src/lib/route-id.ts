/** Segmento após `/creators/12` ou `/l/studio-lumen`, inclusive após rewrite Apache para `/…/_/`. */
export function pathSegment(pathname: string, segment: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const index = parts.indexOf(segment);
  const raw = index >= 0 ? parts[index + 1] : parts.at(-1);
  if (!raw || raw === "_") {
    return null;
  }
  return raw;
}

/** Lê o id numérico de rotas estáticas `/creators/12`, inclusive após rewrite para `/creators/_/`. */
export function numericIdFromPath(pathname: string, segment: string): number | null {
  const raw = pathSegment(pathname, segment);
  if (!raw) {
    return null;
  }
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}
