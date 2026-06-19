import { NextFunction, Request, Response } from 'express';

// Never leak stack traces or internal error text to clients in production.
// Full detail is logged server-side (with the request id) for debugging.
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // eslint-disable-next-line no-console
  console.error(`[api error] [req ${req.id ?? '-'}]`, err);

  const message =
    process.env.NODE_ENV !== 'production' && err instanceof Error
      ? err.message
      : 'Internal server error';

  res.status(500).json({ message, requestId: req.id });
};
