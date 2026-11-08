import type { Metadata, Viewport } from "next";
import { Geist_Mono, Manrope, Quicksand } from "next/font/google";
import { Toaster } from "@/components/toast";
import "./globals.css";

// Quicksand for headings and big numbers, Manrope for body text, Geist Mono for code and links.
const quicksand = Quicksand({ variable: "--font-quicksand", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });

const TITLE = "QuizCheck: AI practice question study";
const DESCRIPTION =
  "Research tool for the project “Accuracy and Usefulness of AI-Generated Practice Questions from Lecture Notes.”";

// Link previews (WhatsApp, iMessage, Slack…) need absolute image URLs. APP_URL is the public address;
// on Vercel the production domain is used if APP_URL is not set.
const siteUrl =
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "QuizCheck",
  openGraph: { type: "website", siteName: "QuizCheck", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${quicksand.variable} ${manrope.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
