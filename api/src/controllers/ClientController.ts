import { Request, Response, NextFunction } from 'express';
import ClientService, {
  ClientNotFoundError,
  DuplicateEmailError
} from '../services/ClientService';
import { ClientStatus } from '../models/client';
import { toPublicClient } from '../lib/obfuscate';

class ClientController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, phone } = req.body;
      const client = await ClientService.create({ name, email, phone });
      return res.status(201).json({
        status: 'success',
        message: 'Client created successfully',
        data: toPublicClient(client)
      });
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        return res.status(409).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const status = req.query.status as ClientStatus;

      const result = await ClientService.list({ page, limit, status });
      return res.status(200).json({
        status: 'success',
        message: 'Clients retrieved successfully',
        data: {
          items: result.items.map((client) => toPublicClient(client)),
          total: result.total,
          page: result.page,
          limit: result.limit
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const allowInactive = req.user?.role === 'admin';
      const client = await ClientService.findById(req.params.id, {
        allowInactive
      });
      return res.status(200).json({
        status: 'success',
        message: 'Client retrieved successfully',
        data: toPublicClient(client)
      });
    } catch (error) {
      if (error instanceof ClientNotFoundError) {
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await ClientService.deactivate(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Client deactivated successfully',
        data: toPublicClient(client)
      });
    } catch (error) {
      if (error instanceof ClientNotFoundError) {
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }
      next(error);
    }
  }
}

export default new ClientController();
