import { PageHeader } from "@/components/admin-ui";
import GenerateForm from "./GenerateForm";

export default function GeneratePage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Generate practice questions"
        subtitle="Upload lecture notes as a PDF or paste the text. The LLM writes multiple-choice questions (or you import them as JSON) to review before publishing."
      />
      <GenerateForm />
    </div>
  );
}
