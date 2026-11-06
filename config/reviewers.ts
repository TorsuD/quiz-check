/**
 * The two expert reviewers for Phase 2.
 *
 * `id` is what gets stored with each review in the database, so do not change an id after
 * reviews have been saved (the old reviews would no longer be linked). `name` is display-only
 * and can be changed at any time, e.g. to "Dr. Mensah" or "TA".
 *
 * Inter-rater agreement is calculated between exactly these two reviewers.
 */
export const REVIEWERS = [
  { id: "A", name: "Reviewer A" },
  { id: "B", name: "Reviewer B" },
] as const;

export type ReviewerId = (typeof REVIEWERS)[number]["id"];

export function isReviewerId(value: unknown): value is ReviewerId {
  return REVIEWERS.some((r) => r.id === value);
}

export function reviewerName(id: string): string {
  return REVIEWERS.find((r) => r.id === id)?.name ?? id;
}
