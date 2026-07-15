import { Request, Response, NextFunction } from 'express';
import User from '../models/user';

/**
 * Verifies admin role against DB. Role is never read from the JWT.
 * Missing user after valid JWT → 401 (token no longer trustworthy).
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        status: 'error',
        message: 'No token, authorization denied'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Token is not valid'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Admin role required'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
