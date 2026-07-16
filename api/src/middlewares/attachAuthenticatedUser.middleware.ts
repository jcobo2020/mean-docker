import { Request, Response, NextFunction } from 'express';
import User from '../models/user';

/**
 * Loads the authenticated user from DB and attaches role to req.user.
 * Valid JWT for a deleted user → 401 (token no longer trustworthy).
 * Existing users without role are treated as 'user'.
 */
export const attachAuthenticatedUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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

    const role = user.role === 'admin' ? 'admin' : 'user';
    req.user = { id: user.id, role };
    next();
  } catch (error) {
    next(error);
  }
};
