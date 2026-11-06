import type { Metadata } from "next";
import Link from "next/link";
import { LogOutIcon, LogoMark } from "@/components/icons";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import HowItWorks from "./HowItWorks";
import MobileNav from "./MobileNav";
import NavLinks from "./NavLinks";

export const metadata: Metadata = { title: "QuizCheck admin", robots: { index: false } };

/** Sidebar contents, shared by the desktop rail and the mobile drawer. Kept deliberately minimal. */
function Sidebar() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-4">
      <Link href="/admin" className="flex items-center gap-2 px-1 pr-8">
        <LogoMark className="h-7 w-7 text-sm" />
        <span className="font-semibold text-ink">QuizCheck</span>
      </Link>

      <nav aria-label="Admin">
        <NavLinks />
      </nav>

      <HowItWorks />

      <div className="mt-auto flex items-center justify-between gap-2 border-t-2 border-line px-1 pt-3">
        <ThemeSwitcher />
        <form action="/api/admin/logout" method="post">
          <button
            title="Log out"
            className="flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs font-semibold text-stone-500 transition hover:bg-field hover:text-rose-700"
          >
            <LogOutIcon className="text-sm" /> Log out
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 overflow-y-auto border-r-2 border-line bg-paper lg:block">
        <Sidebar />
      </aside>
      <MobileNav>
        <Sidebar />
      </MobileNav>
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
