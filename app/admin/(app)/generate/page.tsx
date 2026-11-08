import { connection } from "next/server";
import { Suspense } from "react";
import { LoadingCard, PageHeader } from "@/components/admin-ui";
import { getLLMInfo } from "@/lib/llm";
import GenerateForm from "./GenerateForm";

export default function GeneratePage() {
  return (
    <div>
      <PageHeader
        title="Generate practice questions"
        subtitle="Turn lecture notes into multiple-choice questions. You review every question before students see it."
      />
      <Suspense fallback={<LoadingCard />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  await connection(); // read the LLM settings at request time, not at build time
  return <GenerateForm llm={getLLMInfo()} />;
}
