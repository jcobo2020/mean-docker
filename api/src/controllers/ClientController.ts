import { Request, Response, NextFunction } from 'express';
import ClientService, {
  ClientNotFoundError,
  DuplicateEmailError
} from '../services/ClientService';
import { ClientStatus } from '../models/client';
import { toPublicClient } from '../lib/obfuscate';

class ClientController {
  /**
   * @swagger
   * /api/clients/count:
   *   get:
   *     summary: Count clients, optionally by status
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         required: false
   *         schema:
   *           type: string
   *           enum: [active, inactive]
   *         description: Count only clients with this status. Without it, all clients are counted.
   *     responses:
   *       200:
   *         description: Number of clients
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total:
   *                   type: integer
   *       400:
   *         description: Invalid status (must be active or inactive)
   *       401:
   *         description: Missing or invalid token
   */
  async count(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as ClientStatus | undefined;
      const total = await ClientService.countClients({ status });
      res.status(200).json({ total });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/clients:
   *   post:
   *     summary: Create a client
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, email]
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 120
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Trimmed and lower-cased before saving.
   *               phone:
   *                 type: string
   *                 description: Optional, in E.164 format (for example +593991234567).
   *     responses:
   *       201:
   *         description: Client created (email obfuscated in the response)
   *       400:
   *         description: Invalid name, email or phone
   *       401:
   *         description: Missing or invalid token
   *       403:
   *         description: Admin role required
   *       409:
   *         description: A client with this email already exists
   */
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

  /**
   * @swagger
   * /api/clients:
   *   get:
   *     summary: List clients, paginated, optionally searching by name
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: search
   *         required: false
   *         schema:
   *           type: string
   *           minLength: 2
   *           maxLength: 100
   *         description: >-
   *           Returns only clients whose name contains this text, case-insensitive. It is matched
   *           literally (regex characters such as ".*" are escaped) and accents must match. It is
   *           trimmed first, so only spaces fails with 400. Email is never searched.
   *       - in: query
   *         name: page
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - in: query
   *         name: limit
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 20
   *       - in: query
   *         name: status
   *         required: false
   *         schema:
   *           type: string
   *           enum: [active, inactive]
   *           default: active
   *         description: inactive is admin only (403 otherwise, checked before any other parameter).
   *     responses:
   *       200:
   *         description: >-
   *           A page of clients (email obfuscated). total counts only the clients that match the
   *           filters; a search with no matches returns an empty list and total 0.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     items:
   *                       type: array
   *                       items:
   *                         type: object
   *                     total:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *       400:
   *         description: Invalid search, page, limit or status
   *       401:
   *         description: Missing or invalid token
   *       403:
   *         description: status=inactive requires the admin role
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const status = req.query.status as ClientStatus;
      const search = req.query.search as string | undefined;

      const result = await ClientService.list({ page, limit, status, search });
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

  /**
   * @swagger
   * /api/clients/{id}:
   *   get:
   *     summary: Get a client by id
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: MongoDB ObjectId
   *     responses:
   *       200:
   *         description: The client (email obfuscated)
   *       400:
   *         description: id is not a valid ObjectId
   *       401:
   *         description: Missing or invalid token
   *       404:
   *         description: Client not found
   */
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

  /**
   * @swagger
   * /api/clients/{id}:
   *   delete:
   *     summary: Deactivate a client (it is not deleted)
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: MongoDB ObjectId
   *     responses:
   *       200:
   *         description: Client deactivated
   *       400:
   *         description: id is not a valid ObjectId
   *       401:
   *         description: Missing or invalid token
   *       403:
   *         description: Admin role required
   *       404:
   *         description: Client not found
   */
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

  /**
   * @swagger
   * /api/clients/{id}/reactivate:
   *   post:
   *     summary: Reactivate a deactivated client
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Client reactivated (or already active)
   *       403:
   *         description: Admin role required
   *       404:
   *         description: Client not found
   */
  async reactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await ClientService.reactivate(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Client reactivated successfully',
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
