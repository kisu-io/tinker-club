const MAX_LEN = 40;

export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LEN)
    .replace(/-+$/g, "");
  return base || "group";
}

/**
 * Returns a slug derived from `name` that `exists` reports as free.
 * Appends -2, -3, ... on collision.
 */
export function uniqueSlug(name: string, exists: (slug: string) => boolean): string {
  const base = slugify(name);
  if (!exists(base)) return base;
  for (let i = 2; i < 10000; i++) {
    const candidate = `${base}-${i}`;
    if (!exists(candidate)) return candidate;
  }
  // Practically unreachable at <20 groups.
  return `${base}-${base.length}-x`;
}
