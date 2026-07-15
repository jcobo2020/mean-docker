import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Client from '../models/client';
import ClientService from './ClientService';

describe('ClientService.deactivate (RN-04)', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Client.deleteMany({});
  });

  it('marks status inactive and preserves the row', async () => {
    const created = await Client.create({
      name: 'Acme',
      email: 'acme@example.com',
      phone: '+14155552671',
      status: 'active'
    });

    const result = await ClientService.deactivate(created.id);

    expect(result.status).toBe('inactive');
    expect(result.id).toBe(created.id);

    const row = await Client.findById(created.id);
    expect(row).not.toBeNull();
    expect(row!.status).toBe('inactive');
    expect(row!.name).toBe('Acme');
    expect(row!.email).toBe('acme@example.com');
  });

  it('is idempotent without write when already inactive', async () => {
    const created = await Client.create({
      name: 'Acme',
      email: 'acme@example.com',
      status: 'inactive'
    });
    const previousUpdatedAt = created.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 20));

    const result = await ClientService.deactivate(created.id);
    const reloaded = await Client.findById(created.id);

    expect(result.status).toBe('inactive');
    expect(reloaded!.updatedAt.getTime()).toBe(previousUpdatedAt);
  });
});
