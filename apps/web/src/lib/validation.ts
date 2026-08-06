// Deliberately permissive — catches typos like a missing @ or domain before the
// request goes out, without trying to out-guess the mail server.
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
