import { Request, Response, NextFunction } from 'express';
import FavoriteService from '../services/FavoriteService';
import { ClientNotFoundError } from '../services/ClientService';
import { toPublicClient } from '../lib/obfuscate';

class FavoriteController {
  async mark(req: Request, res: Response, next: NextFunction) {
    try {
      const allowInactive = req.user?.role === 'admin';
      const { favorite, created } = await FavoriteService.markFavorite({
        userId: req.user!.id,
        clientId: req.params.id,
        allowInactive
      });

      return res.status(created ? 201 : 200).json({
        status: 'success',
        message: created
          ? 'Client marked as favorite'
          : 'Client was already marked as favorite',
        data: {
          clientId: favorite.clientId.toString(),
          userId: favorite.userId.toString(),
          createdAt: favorite.createdAt
        }
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

  async unmark(req: Request, res: Response, next: NextFunction) {
    try {
      await FavoriteService.unmarkFavorite({
        userId: req.user!.id,
        clientId: req.params.id,
        allowInactive: true
      });
      return res.status(200).json({
        status: 'success',
        message: 'Client removed from favorites',
        data: {
          clientId: req.params.id,
          userId: req.user!.id,
          deleted: true
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const allowInactive = req.user?.role === 'admin';
      const clients = await FavoriteService.listFavorites({
        userId: req.user!.id,
        allowInactive
      });
      return res.status(200).json({
        status: 'success',
        message: 'Favorite clients retrieved successfully',
        data: clients.map((client) => toPublicClient(client))
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new FavoriteController();
