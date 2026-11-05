/** Whitespace- and case-insensitive check that an excerpt appears in the source text. */
export const normalizeText = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function excerptAppearsIn(excerpt: string, text: string): boolean {
  return normalizeText(text).includes(normalizeText(excerpt));
}
