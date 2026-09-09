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

  describe('reactivate (AC-01, AC-02)', () => {
    it('AC-01 — marks status active and persists the change', async () => {
      const created = await Client.create({
        name: 'Inactive Client',
        email: 'inactive@example.com',
        phone: '+14155552671',
        status: 'inactive'
      });

      const result = await ClientService.reactivate(created.id);

      expect(result.status).toBe('active');
      expect(result.id).toBe(created.id);

      const row = await Client.findById(created.id);
      expect(row).not.toBeNull();
      expect(row!.status).toBe('active');
      expect(row!.name).toBe('Inactive Client');
      expect(row!.email).toBe('inactive@example.com');
    });

    it('AC-01 — is idempotent without write when already active', async () => {
      const created = await Client.create({
        name: 'Already Active',
        email: 'alreadyactive@example.com',
        status: 'active'
      });
      const previousUpdatedAt = created.updatedAt.getTime();

      await new Promise((resolve) => setTimeout(resolve, 20));

      const result = await ClientService.reactivate(created.id);
      const reloaded = await Client.findById(created.id);

      expect(result.status).toBe('active');
      expect(reloaded!.updatedAt.getTime()).toBe(previousUpdatedAt);
    });

    it('AC-02 — throws ClientNotFoundError for non-existent id', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      await expect(
        ClientService.reactivate(nonExistentId)
      ).rejects.toMatchObject({ name: 'ClientNotFoundError' });
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

  describe('countClients (WI-API-CLIENTE-CONTEO-001)', () => {
    it('returns 0 when there are no clients', async () => {
      const total = await ClientService.countClients({});
      expect(total).toBe(0);
    });

    it('AC-01 — returns total of all clients when no filter is given', async () => {
      await Client.create([
        { name: 'Active One', email: 'active1@example.com', status: 'active' },
        { name: 'Active Two', email: 'active2@example.com', status: 'active' },
        { name: 'Inactive One', email: 'inactive1@example.com', status: 'inactive' }
      ]);

      const total = await ClientService.countClients({});
      expect(total).toBe(3);
    });

    it('AC-02 — returns count of active clients when status=active', async () => {
      await Client.create([
        { name: 'Active One', email: 'active1@example.com', status: 'active' },
        { name: 'Active Two', email: 'active2@example.com', status: 'active' },
        { name: 'Inactive One', email: 'inactive1@example.com', status: 'inactive' }
      ]);

      const total = await ClientService.countClients({ status: 'active' });
      expect(total).toBe(2);
    });

    it('returns count of inactive clients when status=inactive', async () => {
      await Client.create([
        { name: 'Active One', email: 'active1@example.com', status: 'active' },
        { name: 'Inactive One', email: 'inactive1@example.com', status: 'inactive' },
        { name: 'Inactive Two', email: 'inactive2@example.com', status: 'inactive' }
      ]);

      const total = await ClientService.countClients({ status: 'inactive' });
      expect(total).toBe(2);
    });

    it('returns a non-negative integer', async () => {
      const total = await ClientService.countClients({});
      expect(total).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(total)).toBe(true);
    });
  });
});
