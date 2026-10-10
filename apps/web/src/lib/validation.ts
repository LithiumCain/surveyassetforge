// Deliberately permissive — catches typos like a missing @ or domain before the
// request goes out, without trying to out-guess the mail server.
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Only https links are rendered as clickable. React writes a "javascript:" href
// into the DOM (it only warns in development), so a stored link with that scheme
// would run script in the session of whoever clicks it. The API now rejects such
// links; this also covers any row written before it did.
export const isSafeHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
