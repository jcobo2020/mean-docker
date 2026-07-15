import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

/**
 * JWT authenticate for new modules — Bearer header only (no ?token= legacy).
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'No token, authorization denied'
      });
    }

    const token = authorization.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No token, authorization denied'
      });
    }

    const decoded = jwt.verify(token, env.secret) as { sub: string };
    req.user = { id: decoded.sub };
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Token is not valid'
    });
  }
};
