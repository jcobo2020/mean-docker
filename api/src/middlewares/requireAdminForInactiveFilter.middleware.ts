import { Request, Response, NextFunction } from 'express';

/**
 * Conditional admin gate for GET /api/clients.
 * Reuses requireAdmin role check only when status=inactive;
 * otherwise continues without requiring admin.
 * 403 message is CLIENTS_FORBIDDEN_FILTER (D1/D3).
 */
export const requireAdminForInactiveFilter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.query.status === 'inactive' && req.user?.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'CLIENTS_FORBIDDEN_FILTER'
    });
  }
  next();
};
