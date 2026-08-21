import ClientFavorite, { IClientFavorite } from '../models/client-favorite';
import { IClient } from '../models/client';
import ClientService, { ClientNotFoundError } from './ClientService';

export interface IClientReader {
  findById(id: string, options: { allowInactive: boolean }): Promise<IClient>;
}

export interface ToggleFavoriteInput {
  userId: string;
  clientId: string;
  allowInactive: boolean;
}

export interface ListFavoritesInput {
  userId: string;
  allowInactive: boolean;
}

/**
 * FavoriteService NO extiende ClientController/ClientService (ARCH-001): la relación favorito
 * tiene su propio ciclo de vida y modelo. Solo depende de ClientService a través del puerto
 * IClientReader — nunca importa la clase concreta directamente en producción (ARCH-002); el
 * default exportado aquí es la única concesión para no introducir un contenedor de DI nuevo en
 * este proyecto.
 */
export class FavoriteService {
  constructor(private readonly clientReader: IClientReader = ClientService) {}

  async markFavorite(
    input: ToggleFavoriteInput
  ): Promise<{ favorite: IClientFavorite; created: boolean }> {
    // RN-03: 404 si el cliente no existe, o existe pero está inactivo sin permiso de verlo.
    await this.clientReader.findById(input.clientId, {
      allowInactive: input.allowInactive
    });

    try {
      const favorite = await ClientFavorite.create({
        userId: input.userId,
        clientId: input.clientId
      });
      return { favorite, created: true };
    } catch (error: unknown) {
      // RN-01: colisión del índice único compuesto (E11000) se trata como éxito idempotente,
      // nunca como 500 — dos POST simultáneos deben converger al mismo estado final.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        const existing = await ClientFavorite.findOne({
          userId: input.userId,
          clientId: input.clientId
        });
        if (existing) {
          return { favorite: existing, created: false };
        }
      }
      throw error;
    }
  }

  async unmarkFavorite(input: ToggleFavoriteInput): Promise<void> {
    // RN-01: idempotente — desmarcar algo que no era favorito no es un error.
    await ClientFavorite.deleteOne({
      userId: input.userId,
      clientId: input.clientId
    });
  }

  async listFavorites(input: ListFavoritesInput): Promise<IClient[]> {
    const favorites = await ClientFavorite.find({ userId: input.userId }).sort({
      createdAt: -1,
      _id: -1
    });

    const clients: IClient[] = [];
    for (const favorite of favorites) {
      try {
        // RN-04: el favorito de un cliente desactivado persiste, pero solo lo ve un admin.
        const client = await this.clientReader.findById(favorite.clientId.toString(), {
          allowInactive: input.allowInactive
        });
        clients.push(client);
      } catch (error) {
        if (error instanceof ClientNotFoundError) {
          continue;
        }
        throw error;
      }
    }
    return clients;
  }
}

export default new FavoriteService();
