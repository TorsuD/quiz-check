import type { Metadata } from "next";
import { LogoMark } from "@/components/icons";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
            <div className="card relative w-full max-w-sm">
        <LogoMark className="h-11 w-11 text-xl" />
        <h1 className="mt-4 text-2xl">Researcher login</h1>
        <p className="mt-1 text-sm text-stone-500">Enter the admin password to continue.</p>
        <LoginForm />
      </div>
    </main>
  );
}
