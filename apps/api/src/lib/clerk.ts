import { createClerkClient } from '@clerk/backend';

// Single shared Clerk Backend client — used to verify session tokens, read user
// profiles, and send invitations. Created once so we don't spin up a client per
// request or per module.
export const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
