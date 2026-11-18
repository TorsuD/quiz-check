import "server-only";

/**
 * Pulls plain text out of an uploaded lecture file. PDFs go through lib/pdf.ts (pdf-parse); everything
 * else goes through officeparser. Used by both /api/admin/extract-text and /api/admin/generate, so the
 * preview always matches what gets stored.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Extensions officeparser reads, plus plain text. Keep in sync with ACCEPT in GenerateForm.tsx. */
const OFFICE_TYPES = ["docx", "pptx", "xlsx", "odt", "odp", "ods", "odg", "rtf", "csv", "md", "html", "epub", "tex"] as const;
type OfficeType = (typeof OFFICE_TYPES)[number];

const PLAIN_TYPES = ["txt", "text", "markdown"];
const ALIASES: Record<string, OfficeType> = { htm: "html", markdown: "md" };
const LEGACY_TYPES = ["doc", "ppt", "xls"];

export const SUPPORTED_LABEL = "PDF, Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, HTML, Markdown, CSV or plain text";

export class UnsupportedFileError extends Error {}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function clean(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractFileText(file: File): Promise<string> {
  const ext = extensionOf(file.name);
  const data = new Uint8Array(await file.arrayBuffer());

  if (ext === "pdf" || (!ext && file.type === "application/pdf")) {
    return (await import("@/lib/pdf")).extractPdfText(data);
  }
  if (PLAIN_TYPES.includes(ext) || (!ext && file.type.startsWith("text/"))) {
    return clean(new TextDecoder("utf-8").decode(data));
  }
  if (LEGACY_TYPES.includes(ext)) {
    throw new UnsupportedFileError(
      `Old .${ext} files can't be read. Open it and save it as .${ext}x (or PDF), then upload that.`,
    );
  }
  const type = ALIASES[ext] ?? (OFFICE_TYPES as readonly string[]).find((t) => t === ext);
  if (!type) throw new UnsupportedFileError(`.${ext || "unknown"} files aren't supported. Use ${SUPPORTED_LABEL}.`);

  const { OfficeParser } = await import("officeparser");
  const ast = await OfficeParser.parseOffice(Buffer.from(data), { fileType: type as OfficeType });
  return clean((await ast.to("text")).value);
}
