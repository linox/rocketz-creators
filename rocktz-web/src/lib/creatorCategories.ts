export const CREATOR_CATEGORY_VALUES = [
  "UGC Content",
  "Influenciador",
  "Ator / Apresentador",
  "Moda & Beleza",
  "Fitness & Saúde",
  "Gastronomia",
  "Tecnologia & Games",
  "Lifestyle",
  "Maternidade",
  "Pets",
  "Automotivo",
  "Humor",
  "Educação",
  "Casa e Decoração",
  "Artesã / Artesanato",
  "Cerâmica",
  "Crochê & Tricô",
  "Costura & Ateliê",
  "Joalheria & Bijuteria",
  "Pintura & Ilustração",
  "Macramê",
  "DIY & Feito à mão",
] as const;

export const LEGACY_CREATOR_CATEGORIES = ["Beleza", "Fitness", "Moda", "Tecnologia", "Saúde"];

export const MAX_CREATOR_CATEGORIES = 12;

export type CreatorCategoryValue = (typeof CREATOR_CATEGORY_VALUES)[number];

export function creatorCategoryOptions(
  labels: Record<string, string>,
  extra: string[] = [],
): { value: string; label: string }[] {
  const values = [...new Set([...CREATOR_CATEGORY_VALUES, ...LEGACY_CREATOR_CATEGORIES, ...extra])].filter(Boolean);
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export function normalizeCreatorCategories(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of values) {
    const value = raw.replace(/\s+/g, " ").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(value.slice(0, 120));
    if (next.length >= MAX_CREATOR_CATEGORIES) break;
  }
  return next;
}
