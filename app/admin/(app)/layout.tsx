import type { Metadata } from "next";
import Link from "next/link";
import { LogOutIcon, LogoMark, Wordmark } from "@/components/icons";
import CollapsibleSidebar from "./CollapsibleSidebar";
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
        <Wordmark />
      </Link>

      <nav aria-label="Admin">
        <NavLinks />
      </nav>

      <HowItWorks />

      <div className="mt-auto flex items-center border-t-2 border-line px-1 pt-3">
        <form action="/api/admin/logout" method="post">
          <button
            title="Log out"
            className="flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs font-semibold whitespace-nowrap text-stone-500 transition hover:bg-field hover:text-rose-700"
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
      <CollapsibleSidebar>
        <Sidebar />
      </CollapsibleSidebar>
      <MobileNav>
        <Sidebar />
      </MobileNav>
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-8 transition-[max-width] duration-300 lg:px-10 lg:py-10 lg:in-data-[sidebar=collapsed]:max-w-7xl lg:in-data-[sidebar=collapsed]:pl-20">{children}</main>
    </div>
  );
}
