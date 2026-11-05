import GenerateForm from "./GenerateForm";

export default function GeneratePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Generate practice questions</h1>
      <p className="mt-1 text-sm text-stone-500">
        Upload lecture notes as a PDF or paste the text. The LLM writes multiple-choice questions (or you import them as JSON) to review before
        publishing.
      </p>
      <GenerateForm />
    </div>
  );
}
