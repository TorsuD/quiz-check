import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  (await cookies()).delete(ADMIN_COOKIE);
  return Response.redirect(new URL("/admin/login", request.url), 303);
}
