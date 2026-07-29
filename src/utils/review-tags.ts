export const CANONICAL_REVIEW_TAGS = [
  { key: "epic", translationKey: "tagEpic", aliases: ["Épico", "Epic"] },
  { key: "relaxing", translationKey: "tagRelaxing", aliases: ["Relajante", "Relaxing", "Relaxante"] },
  { key: "melancholic", translationKey: "tagMelancholic", aliases: ["Melancólico", "Melancholic"] },
  { key: "energetic", translationKey: "tagEnergetic", aliases: ["Enérgico", "Energetic", "Energético"] },
  { key: "dark", translationKey: "tagDark", aliases: ["Oscuro", "Dark", "Sombrio"] },
  { key: "experimental", translationKey: "tagExperimental", aliases: ["Experimental"] },
  { key: "classic", translationKey: "tagClassic", aliases: ["Clásico", "Classic", "Clássico"] },
  { key: "innovative", translationKey: "tagInnovative", aliases: ["Innovador", "Innovative", "Inovador"] },
  { key: "nostalgic", translationKey: "tagNostalgic", aliases: ["Nostálgico", "Nostalgic"] },
  { key: "fun", translationKey: "tagFun", aliases: ["Divertido", "Fun"] },
] as const;

export type CanonicalReviewTag = (typeof CANONICAL_REVIEW_TAGS)[number]["key"];
export type ReviewTagTranslationKey = (typeof CANONICAL_REVIEW_TAGS)[number]["translationKey"];

function normalizeAlias(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const tagsByAlias = new Map<string, (typeof CANONICAL_REVIEW_TAGS)[number]>(
  CANONICAL_REVIEW_TAGS.flatMap((tag) => [tag.key, ...tag.aliases].map((alias) => [normalizeAlias(alias), tag] as const)),
);

export function getCanonicalReviewTag(value: string | null | undefined): CanonicalReviewTag | null {
  if (!value) return null;
  return tagsByAlias.get(normalizeAlias(value))?.key ?? null;
}

export function getReviewTagTranslationKey(value: string | null | undefined): ReviewTagTranslationKey | null {
  if (!value) return null;
  return tagsByAlias.get(normalizeAlias(value))?.translationKey ?? null;
}

/** Converts known legacy labels to stable keys while leaving free-form tags unchanged. */
export function normalizeReviewTag(value: string): string {
  const trimmed = value.trim();
  return getCanonicalReviewTag(trimmed) ?? trimmed;
}

export function normalizeReviewTagValues(values: readonly string[], limit = 5): string[] {
  return values.map(normalizeReviewTag).filter(Boolean).slice(0, limit);
}

export function normalizeReviewTagsForStorage(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  return normalizeReviewTagValues(
    value.map((tag) => (typeof tag === "string" ? tag.substring(0, 20) : "")),
  ).join(",") || null;
}

/** Recap aggregates only RTM's known mood categories; free-form user tags are not rewritten. */
export function getTopCanonicalReviewTag(tags: readonly (string | null | undefined)[]): CanonicalReviewTag | null {
  const counts = new Map<CanonicalReviewTag, number>();

  for (const tagList of tags) {
    if (!tagList) continue;
    for (const tag of tagList.split(",")) {
      const canonicalTag = getCanonicalReviewTag(tag);
      if (canonicalTag) counts.set(canonicalTag, (counts.get(canonicalTag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
