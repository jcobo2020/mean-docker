import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ClientFavorite from '../models/client-favorite';
import { IClient } from '../models/client';
import { FavoriteService, IClientReader } from './FavoriteService';
import { ClientNotFoundError } from './ClientService';

function fakeClient(id: string, status: 'active' | 'inactive' = 'active'): IClient {
  return { id, status } as unknown as IClient;
}

describe('FavoriteService (unit — mocked IClientReader port)', () => {
  let mongoServer: MongoMemoryServer;
  const userId = new mongoose.Types.ObjectId().toString();
  const clientId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await ClientFavorite.deleteMany({});
  });

  it('markFavorite creates a row when the client reader confirms existence', async () => {
    const reader: IClientReader = {
      findById: jest.fn().mockResolvedValue(fakeClient(clientId))
    };
    const service = new FavoriteService(reader);

    const { created } = await service.markFavorite({ userId, clientId, allowInactive: false });

    expect(created).toBe(true);
    expect(reader.findById).toHaveBeenCalledWith(clientId, { allowInactive: false });
    const stored = await ClientFavorite.findOne({ userId, clientId });
    expect(stored).not.toBeNull();
  });

  it('markFavorite propagates ClientNotFoundError from the port without writing', async () => {
    const reader: IClientReader = {
      findById: jest.fn().mockRejectedValue(new ClientNotFoundError())
    };
    const service = new FavoriteService(reader);

    await expect(
      service.markFavorite({ userId, clientId, allowInactive: false })
    ).rejects.toBeInstanceOf(ClientNotFoundError);

    expect(await ClientFavorite.countDocuments({})).toBe(0);
  });

  it('markFavorite twice is idempotent (RN-01) even under a duplicate-key race', async () => {
    const reader: IClientReader = {
      findById: jest.fn().mockResolvedValue(fakeClient(clientId))
    };
    const service = new FavoriteService(reader);

    const first = await service.markFavorite({ userId, clientId, allowInactive: false });
    const second = await service.markFavorite({ userId, clientId, allowInactive: false });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await ClientFavorite.countDocuments({ userId, clientId })).toBe(1);
  });

  it('unmarkFavorite on a non-existent favorite does not throw (RN-01 idempotent)', async () => {
    const reader: IClientReader = { findById: jest.fn() };
    const service = new FavoriteService(reader);

    await expect(
      service.unmarkFavorite({ userId, clientId, allowInactive: false })
    ).resolves.toBeUndefined();
  });

  it('listFavorites skips rows whose client is no longer visible via the port (defensive)', async () => {
    await ClientFavorite.create({ userId, clientId });
    const reader: IClientReader = {
      findById: jest.fn().mockRejectedValue(new ClientNotFoundError())
    };
    const service = new FavoriteService(reader);

    const clients = await service.listFavorites({ userId, allowInactive: false });

    expect(clients).toHaveLength(0);
  });
});
