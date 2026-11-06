import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono, IBM_Plex_Mono, Pixelify_Sans } from "next/font/google";
import { Toaster } from "@/components/toast";
import { DEFAULT_THEME, THEME_BOOT_SCRIPT } from "@/lib/themes";
import "./globals.css";

// Fonts for every theme (see app/globals.css). Only the default theme's (retro) fonts are
// preloaded; the others download when their theme is picked. next/font needs literal options,
// so if you change DEFAULT_THEME in lib/themes.ts, move `preload: true` to that theme's fonts.

// Retro: pixel headings, typewriter-style monospace body.
const pixel = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"], preload: true });
const plex = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: true,
});
// Editorial: serif headings. Editorial and dark: Geist body.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], preload: false });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], preload: false });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "QuizCheck: AI practice question study",
  description:
    "Research tool for the project “Accuracy and Usefulness of AI-Generated Practice Questions from Lecture Notes.”",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [pixel, plex, fraunces, geist, geistMono].map((f) => f.variable).join(" ");
  return (
    // The boot script may change data-theme before React hydrates, hence suppressHydrationWarning.
    <html lang="en" data-theme={DEFAULT_THEME} className={`${fonts} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
