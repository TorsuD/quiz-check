import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "QuizCheck admin", robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="font-semibold text-stone-900">
            QuizCheck <span className="font-normal text-stone-500">admin</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/admin" className="rounded-md px-3 py-1.5 text-stone-700 hover:bg-stone-100">
              Lectures
            </Link>
            <Link href="/admin/generate" className="rounded-md px-3 py-1.5 text-stone-700 hover:bg-stone-100">
              Generate
            </Link>
            <form action="/api/admin/logout" method="post">
              <button className="rounded-md px-3 py-1.5 text-stone-500 hover:bg-stone-100">Log out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
