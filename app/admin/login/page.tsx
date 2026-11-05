import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm">
        <h1 className="text-lg font-semibold">Researcher login</h1>
        <p className="mt-1 text-sm text-stone-500">Enter the admin password to continue.</p>
        <LoginForm />
      </div>
    </main>
  );
}
