"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { FileIcon, SparklesIcon } from "@/components/icons";

const LINKS = [
  {
    href: "/admin",
    label: "Lectures",
    icon: FileIcon,
    match: (p: string) => p === "/admin" || ["/admin/lectures", "/admin/quiz", "/admin/review", "/admin/results"].some((prefix) => p.startsWith(prefix)),
  },
  {
    href: "/admin/generate",
    label: "Generate",
    icon: SparklesIcon,
    match: (p: string) => p.startsWith("/admin/generate"),
  },
];

function Links({ pathname }: { pathname: string | null }) {
  return (
    <ul className="space-y-0.5">
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = pathname !== null && match(pathname);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm font-semibold transition ${
                active ? "bg-yellow-300 text-ink" : "text-stone-600 hover:bg-field hover:text-ink"
              }`}
            >
              <Icon className="shrink-0" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveLinks() {
  return <Links pathname={usePathname()} />;
}

/** Reading the URL is request-time data, so the highlighted version streams in behind Suspense. */
export default function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <ActiveLinks />
    </Suspense>
  );
}
