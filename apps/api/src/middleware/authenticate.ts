import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../services/auth.js';
import { AuthUser } from '../types/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or invalid authorization header' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      siteId: payload.siteId,
      username: payload.username,
    };
    next();
  } catch (_err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
