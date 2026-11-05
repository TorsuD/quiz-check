import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "./auth";

/** Defense in depth: proxy.ts guards admin routes, and handlers/actions re-check here. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminToken(store.get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
