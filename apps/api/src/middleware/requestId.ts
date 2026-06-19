import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

// Tag every request with an id (echoed in the X-Request-Id response header and
// in error logs) so a specific failure can be traced back to its log line.
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.header('x-request-id');
  const id = (incoming && incoming.length <= 64 ? incoming : randomUUID());
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};
