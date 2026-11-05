/**
 * Admin auth: a single shared password (ADMIN_PASSWORD). On login we set an httpOnly
 * cookie containing an HMAC derived from the password, so the password itself is never
 * stored in the cookie, and changing ADMIN_PASSWORD logs everyone out.
 * Uses Web Crypto so it works in proxy.ts as well as route handlers.
 */

export const ADMIN_COOKIE = "qc_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function expectedAdminToken(): Promise<string | null> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return hmacHex(pw, "quizcheck-admin-session");
}

export async function isValidAdminToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expected = await expectedAdminToken();
  return expected !== null && safeEqual(token, expected);
}

export async function checkPassword(password: string): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  // Compare HMACs so the comparison is constant-length.
  const [a, b] = await Promise.all([hmacHex("pw", password), hmacHex("pw", pw)]);
  return safeEqual(a, b);
}
