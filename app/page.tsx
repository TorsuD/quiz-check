import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium tracking-wide text-stone-500 uppercase">COMP-5112 research project</p>
      <h1 className="mt-2 text-3xl leading-tight font-semibold text-stone-900">
        Accuracy and Usefulness of AI-Generated Practice Questions from Lecture Notes
      </h1>
      <p className="mt-4 text-stone-600">
        Students: please use the link or QR code shown in class to take the survey. Researchers can sign in below.
      </p>
      <div className="mt-8">
        <Link href="/admin" className="btn-primary">
          Researcher dashboard
        </Link>
      </div>
    </main>
  );
}
