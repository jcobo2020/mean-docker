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

export const validateListClients = [
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
