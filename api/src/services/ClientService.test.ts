import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Client from '../models/client';
import ClientService from './ClientService';

describe('ClientService', () => {
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

  describe('deactivate (RN-04)', () => {
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

  describe('list', () => {
    it('filters by status and sorts createdAt desc, _id desc', async () => {
      const older = await Client.create({
        name: 'Older',
        email: 'older@example.com',
        status: 'active',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z')
      });
      const newer = await Client.create({
        name: 'Newer',
        email: 'newer@example.com',
        status: 'active',
        createdAt: new Date('2024-06-01T00:00:00.000Z'),
        updatedAt: new Date('2024-06-01T00:00:00.000Z')
      });
      await Client.create({
        name: 'Inactive',
        email: 'inactive@example.com',
        status: 'inactive'
      });

      const result = await ClientService.list({
        page: 1,
        limit: 20,
        status: 'active'
      });

      expect(result.total).toBe(2);
      expect(result.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    });
  });

  describe('findById', () => {
    it('hides inactive clients when allowInactive is false', async () => {
      const created = await Client.create({
        name: 'Hidden',
        email: 'hidden@example.com',
        status: 'inactive'
      });

      await expect(
        ClientService.findById(created.id, { allowInactive: false })
      ).rejects.toMatchObject({ name: 'ClientNotFoundError' });
    });

    it('returns inactive clients when allowInactive is true', async () => {
      const created = await Client.create({
        name: 'Visible',
        email: 'visible@example.com',
        status: 'inactive'
      });

      const result = await ClientService.findById(created.id, {
        allowInactive: true
      });
      expect(result.id).toBe(created.id);
      expect(result.status).toBe('inactive');
    });
  });
});
