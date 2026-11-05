# QuizCheck

Research tool for the project **"Accuracy and Usefulness of AI-Generated Practice Questions from Lecture Notes"** (COMP-5112).

Researchers upload lecture notes, an LLM generates multiple-choice practice questions, the researchers review and remove bad ones, and students take the quiz on their phones in class and rate every question. All responses can be exported as CSV.

**Status:** Phase 1 (generation, review, publishing, the student survey, CSV export) is done. Phase 2 (expert review mode and results dashboard) is planned.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · MongoDB + Mongoose · pdf-parse · qrcode · zod. LLM: Anthropic, OpenAI, or Gemini, swappable in `lib/llm.ts`.

## Setup

Requirements: Node.js 20+ and a MongoDB database. A free [MongoDB Atlas](https://www.mongodb.com/atlas) M0 cluster is fine.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run seed                 # optional: sample lecture + open quiz, no LLM needed
npm run dev                  # http://localhost:3000
```

Open `http://localhost:3000/admin` and sign in with `ADMIN_PASSWORD`.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string, e.g. `mongodb+srv://user:pass@cluster0.xxx.mongodb.net/quizcheck` |
| `ADMIN_PASSWORD` | yes | Password for all `/admin` pages. Changing it signs everyone out. |
| `LLM_PROVIDER` | yes | `anthropic`, `openai`, or `gemini` |
| `LLM_API_KEY` | yes | API key for the chosen provider. Used only on the server and never sent to the browser. |
| `LLM_MODEL` | no | Model id. Defaults: `claude-opus-5-5` (Anthropic), `gpt-4o` (OpenAI), `gemini-flash-latest` (Gemini). **If you change `LLM_PROVIDER`, change or clear this too.** |
| `APP_URL` | no | Public base URL for quiz links and QR codes, e.g. `https://quizcheck.vercel.app`. If unset, it is taken from the request. |

## Seed script

```bash
npm run seed
```

The seed script inserts a sample lecture ("[Sample] Database Normalization") with 5 questions. One of them is pre-removed with a reason, so you can see how soft-deleted questions look. It also publishes an **open** quiz and prints the student and admin URLs. Running it again replaces the previous sample data, including its responses. Nothing else is touched.

The script reads `.env.local` (or `.env`) for `MONGODB_URI`.

## Workflow

1. **Generate** (`/admin/generate`): upload a text-based PDF or paste the notes, give a title, and pick a number of questions (default 10). The server extracts the text and calls the LLM with the prompt in `lib/prompts.ts`. It strips code fences, validates the JSON with zod, and retries once with the validation error if the output is invalid.
   - **Import JSON (backup):** if the API is down or out of credit, switch the form to *Import JSON*. *Copy prompt* copies the exact study prompt with your pasted notes. Run it in any chatbot and paste the result back. The import goes through the same fence stripping and validation as LLM output, and the "Model used" label you enter is stored in each question's `model` field, with `provider: "import"`. The lecture notes are still required.
2. **Review** (`/admin/lectures/[id]`): check each question, its answer key, the explanation, and the source excerpt. A warning badge marks questions whose excerpt was not found word for word in the notes. **Remove** asks for a reason. Removed questions are never deleted: they stay in MongoDB with `removedBeforeSurvey: true`, `removalReason`, and `removedAt`.
3. **Publish**: this saves the remaining questions, in order, as a quiz and locks the set.
4. **In class** (`/admin/quiz/[id]`): shows the QR code and link. *Open full-screen QR for slides* gives a large version for the projector. You can open or close the quiz at any time. Closing it stops new students from starting, but students who already started can finish.
5. **Export**: two CSV downloads on the same page:
   - **Responses CSV**: one row per participant per question, with the selected and correct option, correctness, all four ratings, the error flag, and timestamps. Unanswered questions appear as blank rows, so partial attempts are visible.
   - **Survey CSV**: one row per participant who submitted the final survey. `comparedToInstructorScore` codes the answer from 1 (much worse) to 5 (much better).

### Student experience (`/quiz/[id]`)

- A consent screen. No login is needed. An anonymous participant ID is stored in an httpOnly cookie, and a student who returns on the same device resumes where they left off instead of starting a duplicate attempt.
- One question per screen: answer, then see whether it was correct and the explanation, then rate clarity, difficulty, usefulness, and perceived accuracy from 1 to 5, with an optional "this question has an error" box.
- **The first answer is final.** The correct answer is not sent to the browser until the student submits.
- Every answer and rating is saved right away.
- A final survey and a thank-you screen.

## Data model (`lib/models.ts`)

All collections have `createdAt` / `updatedAt`.

| Model | Key fields |
| --- | --- |
| Lecture | title, sourceType (pdf/text), fileName, text |
| Question | lectureId, order, question, options[4], correctIndex, explanation, sourceExcerpt, excerptFoundInText, difficulty, model, provider, generatedAt, removedBeforeSurvey, removalReason, removedAt |
| Quiz | lectureId, title, questionIds (snapshot at publish time), isOpen, publishedAt |
| Participant | quizId, participantId (anonymous UUID), consentedAt, completedAt, userAgent |
| QuestionResponse | quizId, questionId, participantId, selectedIndex, isCorrect, clarity, difficulty, usefulness, perceivedAccuracy, flaggedError, answeredAt, ratedAt |
| SurveyResponse | quizId, participantId, wouldUse, comparedToInstructor, examHelp, helpfulText, unhelpfulText |
| ExpertReview | quizId, questionId, reviewer, factuallyCorrect, answerKeyCorrect, relevance, clarity, errorTags, otherNote (Phase 2) |

Unique indexes stop duplicate participants, duplicate responses per question, and duplicate surveys.

## Project layout

```
proxy.ts               auth guard for /admin and /api/admin (Next 16 renamed middleware to proxy)
lib/llm.ts             provider switch (Anthropic / OpenAI / Gemini)
lib/prompts.ts         the generation prompt (for the presentation)
lib/generate.ts        fence stripping, zod validation, single retry
lib/models.ts          Mongoose models
lib/exports.ts         CSV builders
app/admin/...          researcher pages and server actions
app/quiz/[quizId]/     the student flow (QuizFlow.tsx)
app/api/...            generation, CSV export, student save endpoints
scripts/seed.ts        sample data
```

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel. The framework preset is detected as Next.js.
2. In **Project → Settings → Environment Variables**, add `MONGODB_URI`, `ADMIN_PASSWORD`, `LLM_PROVIDER`, `LLM_API_KEY`, optionally `LLM_MODEL`, and `APP_URL` set to your production URL so the QR codes point to the right domain.
3. In MongoDB Atlas, open **Network Access** and allow `0.0.0.0/0`. Vercel functions do not have fixed IP addresses.
4. Deploy. To seed the production database, run `npm run seed` locally with `MONGODB_URI` pointing at it.

Notes:

- The generation endpoint sets `maxDuration = 300` seconds. Large lectures with a big model can take a minute or more, which fits within Vercel's limits when Fluid compute is on (the default).
- Vercel limits request bodies to about 4.5 MB. For larger PDFs, paste the text instead.
- Run a full test on your phone, using the deployed URL, before class.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run seed` | Insert sample data |
