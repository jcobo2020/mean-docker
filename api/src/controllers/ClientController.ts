import { Request, Response, NextFunction } from 'express';
import ClientService, {
  ClientNotFoundError,
  DuplicateEmailError
} from '../services/ClientService';
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
