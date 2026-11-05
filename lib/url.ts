import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** Public base URL: APP_URL if set (recommended in production), else derived from the request. */
export async function getBaseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function quizUrlAndQr(quizId: string, width = 360) {
  const url = `${await getBaseUrl()}/quiz/${quizId}`;
  const qr = await QRCode.toDataURL(url, { width, margin: 1, errorCorrectionLevel: "M" });
  return { url, qr };
}
