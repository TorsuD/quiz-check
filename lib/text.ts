/** Whitespace- and case-insensitive check that an excerpt appears in the source text. */
export const normalizeText = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function excerptAppearsIn(excerpt: string, text: string): boolean {
  return normalizeText(text).includes(normalizeText(excerpt));
}

/** Remove ```json ... ``` fences and any text before the first "{" / after the last "}". */
export function stripCodeFences(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) s = s.slice(start, end + 1);
  return s;
}

const SMART_DOUBLE_QUOTES = /[“”„‟″‶]/g;

/**
 * JSON.parse after stripping code fences. If that fails and the text contains curly "smart" double
 * quotes (added by Word, Notes, phone keyboards…), retries with them replaced by straight quotes.
 * Curly single quotes (’) are left alone: they are valid inside JSON strings.
 */
export function parseJsonLoose(raw: string): { data: unknown; fixedQuotes: boolean } {
  const cleaned = stripCodeFences(raw);
  try {
    return { data: JSON.parse(cleaned), fixedQuotes: false };
  } catch (err) {
    if (!raw.match(SMART_DOUBLE_QUOTES)) throw err;
    return { data: JSON.parse(stripCodeFences(raw.replace(SMART_DOUBLE_QUOTES, '"'))), fixedQuotes: true };
  }
}
