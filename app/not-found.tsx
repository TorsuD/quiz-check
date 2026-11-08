import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, LogoMark, Wordmark } from "@/components/icons";

export const metadata: Metadata = { title: "Page not found · QuizCheck" };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <Link href="/" className="mb-4 inline-flex items-center gap-2.5">
          <LogoMark />
          <Wordmark />
        </Link>

        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Illustration */}
          <div className="flex items-center justify-center bg-stone-50 p-8 md:border-r md:border-line">
            <LostQuizCard />
          </div>

          {/* Message */}
          <div className="flex flex-col justify-center p-8 sm:p-10">
            <p className="text-sm font-semibold text-stone-500">Error 404</p>
            <h1 className="mt-2 text-3xl text-ink sm:text-4xl">This question isn&apos;t on the quiz</h1>
            <p className="mt-3 text-stone-600">
              We looked everywhere, but the page you&apos;re after doesn&apos;t exist. It may have moved, or the link has a typo.
            </p>
            <p className="mt-3 text-sm text-stone-500">
              Taking the survey? Scan the QR code or open the link shown in class again.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/" className="btn-primary">
                <ArrowLeftIcon /> Back to home
              </Link>
              <Link href="/admin" className="btn-secondary">
                Researcher dashboard <ArrowRightIcon />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/** A small quiz card searching for the missing page with a magnifying glass. Decorative. */
function LostQuizCard() {
  return (
    <svg viewBox="0 0 260 220" className="h-auto w-full max-w-[280px]" role="img" aria-label="A confused quiz card holding a magnifying glass">
      {/* ground shadow */}
      <ellipse cx="118" cy="200" rx="70" ry="8" fill="#e5e5e5" />

      {/* floating question marks */}
      <text x="196" y="52" fontSize="34" fontWeight="700" fill="#0a0a0a" fontFamily="var(--font-quicksand), sans-serif" transform="rotate(14 196 52)">
        ?
      </text>
      <text x="30" y="66" fontSize="22" fontWeight="700" fill="#a3a3a3" fontFamily="var(--font-quicksand), sans-serif" transform="rotate(-16 30 66)">
        ?
      </text>

      {/* the card (a quiz sheet), slightly tilted */}
      <g transform="rotate(-6 118 120)">
        <rect x="62" y="40" width="112" height="146" rx="14" fill="#ffffff" stroke="#0a0a0a" strokeWidth="3" />
        {/* folded corner */}
        <path d="M150 40 h10 a14 14 0 0 1 14 14 v10 z" fill="#fef9c3" stroke="#0a0a0a" strokeWidth="3" strokeLinejoin="round" />
        {/* answer lines */}
        <rect x="80" y="62" width="58" height="7" rx="3.5" fill="#e5e5e5" />
        <circle cx="84" cy="150" r="5" fill="none" stroke="#a3a3a3" strokeWidth="2.5" />
        <rect x="95" y="147" width="46" height="6" rx="3" fill="#e5e5e5" />
        <circle cx="84" cy="168" r="5" fill="none" stroke="#a3a3a3" strokeWidth="2.5" />
        <rect x="95" y="165" width="34" height="6" rx="3" fill="#e5e5e5" />

        {/* face */}
        <ellipse cx="97" cy="104" rx="5" ry="6.5" fill="#0a0a0a" />
        <ellipse cx="135" cy="104" rx="5" ry="6.5" fill="#0a0a0a" />
        <circle cx="99" cy="101.5" r="1.6" fill="#ffffff" />
        <circle cx="137" cy="101.5" r="1.6" fill="#ffffff" />
        {/* raised eyebrow */}
        <path d="M128 90 q7 -5 14 -1" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" />
        {/* small "o" mouth */}
        <ellipse cx="116" cy="124" rx="5" ry="6" fill="none" stroke="#0a0a0a" strokeWidth="3" />
        {/* blush */}
        <ellipse cx="86" cy="118" rx="7" ry="4" fill="#fde68a" opacity="0.9" />
        <ellipse cx="146" cy="118" rx="7" ry="4" fill="#fde68a" opacity="0.9" />

        {/* arm holding the magnifying glass */}
        <path d="M172 128 q16 2 22 -10" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* magnifying glass */}
      <g>
        <line x1="208" y1="124" x2="228" y2="150" stroke="#0a0a0a" strokeWidth="8" strokeLinecap="round" />
        <circle cx="196" cy="106" r="22" fill="#fef9c3" fillOpacity="0.85" stroke="#0a0a0a" strokeWidth="4" />
        <path d="M184 98 a13 13 0 0 1 10 -8" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* little feet */}
      <path d="M100 190 v8 h-9" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M134 187 v9 h9" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
