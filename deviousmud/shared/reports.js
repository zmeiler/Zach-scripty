/**
 * Report reasons, shared by the client's report window and the server's
 * validation, so the two can never drift apart.
 *
 * The wording is deliberately plain: a nine-year-old should be able to pick the
 * right one without an adult translating it.
 */

export const REPORT_REASONS = Object.freeze([
  { id: 'rude', label: 'Rude or unkind words' },
  { id: 'bullying', label: 'Bullying or threats' },
  { id: 'spam', label: 'Spamming or flooding chat' },
  { id: 'personal', label: 'Asking for personal details' },
  { id: 'cheating', label: 'Cheating or exploiting' },
  { id: 'other', label: 'Something else' }
]);

export function reportReason(id) {
  return REPORT_REASONS.find((reason) => reason.id === id) || null;
}
