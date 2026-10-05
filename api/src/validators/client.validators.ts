import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export const validateCreateClient = [
  body('name')
    .exists({ checkFalsy: true })
    .withMessage('name is required')
    .isString()
    .withMessage('name must be a string')
    .isLength({ min: 1, max: 120 })
    .withMessage('name must be between 1 and 120 characters'),
  body('email')
    .exists({ checkFalsy: true })
    .withMessage('email is required')
    .customSanitizer((value: unknown) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value
    )
    .isEmail()
    .withMessage('email must be a valid email'),
  body('phone')
    .optional({ values: 'falsy' })
    .custom((value: unknown) => {
      if (value === undefined || value === null || value === '') {
        return true;
      }
      if (typeof value !== 'string' || !E164_REGEX.test(value)) {
        throw new Error('phone must be a valid E.164 number');
      }
      return true;
    }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: errors.array()[0].msg
      });
    }
    next();
  }
];

export const validateClientId = [
  param('id')
    .isMongoId()
    .withMessage('id must be a valid ObjectId'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: errors.array()[0].msg
      });
    }
    next();
  }
];

export const validateCountClients = [
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('status must be active or inactive'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

export const validateUpdateClientNote = [
  param('id')
    .isMongoId()
    .withMessage('id must be a valid ObjectId'),
  body('internalNote')
    .optional({ values: 'null' })
    .custom((value: unknown) => {
      if (value === null || value === undefined || value === '') {
        return true;
      }
      if (typeof value !== 'string') {
        throw new Error('internalNote must be a string or null');
      }
      if (value.length > 280) {
        throw new Error('CLIENT_NOTE_TOO_LONG');
      }
      return true;
    }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      const status = firstError.msg === 'CLIENT_NOTE_TOO_LONG' ||
        firstError.msg.includes('CLIENT_NOTE_TOO_LONG')
        ? 400
        : 400;
      return res.status(status).json({
        errors: errors.array().map((e) => ({
          field: 'field' in e ? e.field : 'internalNote',
          message: e.msg
        }))
      });
    }
    next();
  }
];

export const validateListClients = [
  query('search')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('search must be between 2 and 100 characters'),
  query('page')
    .default(1)
    .isInt({ min: 1 })
    .withMessage('page must be an integer >= 1')
    .toInt(),
  query('limit')
    .default(20)
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be an integer between 1 and 50')
    .toInt(),
  query('status')
    .default('active')
    .isIn(['active', 'inactive'])
    .withMessage('status must be active or inactive'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: errors.array()[0].msg
      });
    }
    next();
  }
];
