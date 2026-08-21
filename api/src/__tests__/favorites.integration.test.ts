import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import User from '../models/user';
import Client from '../models/client';
import ClientFavorite from '../models/client-favorite';
import env from '../config/env';
import { obfuscateValue } from '../lib/obfuscate';

describe('Favorites API (WI-API-CLIENTES-FAV-001)', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();
  let adminToken: string;
  let userToken: string;
  let userId: string;
  let adminId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      username: 'admin-fav',
      password: 'secret',
      role: 'admin'
    });
    const regular = await User.create({
      firstName: 'Regular',
      lastName: 'User',
      username: 'regular-fav',
      password: 'secret',
      role: 'user'
    });
    adminId = admin.id;
    userId = regular.id;

    adminToken = jwt.sign({ sub: admin.id }, env.secret, { algorithm: 'HS256' });
    userToken = jwt.sign({ sub: regular.id }, env.secret, { algorithm: 'HS256' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Client.deleteMany({});
    await ClientFavorite.deleteMany({});
  });

  describe('RN-06 — JWT required', () => {
    it('POST /api/clients/:id/favorite without token returns 401', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app).post(`/api/clients/${id}/favorite`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('DELETE /api/clients/:id/favorite without token returns 401', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app).delete(`/api/clients/${id}/favorite`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('GET /api/clients/favorites without token returns 401', async () => {
      const res = await request(app).get('/api/clients/favorites');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });

  describe('POST /api/clients/:id/favorite', () => {
    it('AC-01 — marks a client as favorite and returns 201', async () => {
      const client = await Client.create({
        name: 'Acme',
        email: 'acme@example.com',
        status: 'active'
      });

      const res = await request(app)
        .post(`/api/clients/${client.id}/favorite`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toMatchObject({
        clientId: client.id,
        userId,
        createdAt: expect.any(String)
      });

      const stored = await ClientFavorite.findOne({ userId, clientId: client.id });
      expect(stored).not.toBeNull();
    });

    it('AC-02 — a second POST on the same client is idempotent and returns 200', async () => {
      const client = await Client.create({
        name: 'Acme',
        email: 'acme2@example.com',
        status: 'active'
      });

      await request(app)
        .post(`/api/clients/${client.id}/favorite`)
        .set('Authorization', `Bearer ${userToken}`);
      const second = await request(app)
        .post(`/api/clients/${client.id}/favorite`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(second.status).toBe(200);
      const rows = await ClientFavorite.find({ userId, clientId: client.id });
      expect(rows).toHaveLength(1);
    });

    it('AC-04 — never modifies the Client document', async () => {
      const client = await Client.create({
        name: 'Untouched',
        email: 'untouched@example.com',
        phone: '+14155552671',
        status: 'active'
      });
      const before = client.toObject();

      await request(app)
        .post(`/api/clients/${client.id}/favorite`)
        .set('Authorization', `Bearer ${userToken}`);

      const after = await Client.findById(client.id);
      expect(after!.name).toBe(before.name);
      expect(after!.email).toBe(before.email);
      expect(after!.phone).toBe(before.phone);
      expect(after!.status).toBe(before.status);
      expect(after!.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });

    it('AC-05 — returns 404 for a non-existent client', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/clients/${id}/favorite`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });

    it('AC-06 — non-admin gets 404 for an inactive client (same as non-existent)', async () => {
      const client = await Client.create({
        name: 'Hidden',
        email: 'hidden-fav@example.com',
        status: 'inactive'
      });
      const res = await request(app)
        .post(`/api/clients/${client.id}/favorite`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
    });

    it('AC-12 — admin can mark favorite an inactive client', async () => {
      const client = await Client.create({
        name: 'Hidden For User',
        email: 'hidden-admin@example.com',
        status: 'inactive'
      });
      const res = await request(app)
        .post(`/api/clients/${client.id}/favorite`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(201);
    });

    it('returns 400 for an invalid ObjectId', async () => {
      const res = await request(app)
        .post('/api/clients/not-an-objectid/favorite')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });
  });

  describe('DELETE /api/clients/:id/favorite', () => {
    it('AC-03 — unmarking a client that was not favorite returns 200 (idempotent)', async () => {
      const client = await Client.create({
        name: 'Never Favorited',
        email: 'never@example.com',
        status: 'active'
      });
      const res = await request(app)
        .delete(`/api/clients/${client.id}/favorite`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        clientId: client.id,
        userId,
        deleted: true
      });
    });

    it('unmarks an existing favorite', async () => {
      const client = await Client.create({
        name: 'To Unmark',
        email: 'tounmark@example.com',
        status: 'active'
      });
      await ClientFavorite.create({ userId, clientId: client.id });

      const res = await request(app)
        .delete(`/api/clients/${client.id}/favorite`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      const stored = await ClientFavorite.findOne({ userId, clientId: client.id });
      expect(stored).toBeNull();
    });
  });

  describe('GET /api/clients/favorites', () => {
    it('AC-08 — non-admin does not see favorites of inactive clients', async () => {
      const active = await Client.create({
        name: 'Active Fav',
        email: 'active-fav@example.com',
        status: 'active'
      });
      const inactive = await Client.create({
        name: 'Inactive Fav',
        email: 'inactive-fav@example.com',
        status: 'inactive'
      });
      await ClientFavorite.create({ userId, clientId: active.id });
      await ClientFavorite.create({ userId, clientId: inactive.id });

      const res = await request(app)
        .get('/api/clients/favorites')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(active.id);
    });

    it('AC-09 — admin sees favorites of active and inactive clients (RN-04)', async () => {
      const active = await Client.create({
        name: 'Active Fav',
        email: 'active-fav2@example.com',
        status: 'active'
      });
      const inactive = await Client.create({
        name: 'Inactive Fav',
        email: 'inactive-fav2@example.com',
        status: 'inactive'
      });
      await ClientFavorite.create({ userId: adminId, clientId: active.id });
      await ClientFavorite.create({ userId: adminId, clientId: inactive.id });

      const res = await request(app)
        .get('/api/clients/favorites')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('AC-10 — response is obfuscated the same as GET /api/clients', async () => {
      const client = await Client.create({
        name: 'Obfuscated',
        email: 'obfuscated@example.com',
        phone: '+14155552671',
        status: 'active'
      });
      await ClientFavorite.create({ userId, clientId: client.id });

      const res = await request(app)
        .get('/api/clients/favorites')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.body.data[0].email).toBe(obfuscateValue('obfuscated@example.com'));
      expect(res.body.data[0].phone).toBe(obfuscateValue('+14155552671'));
      expect(res.body.data[0].email).not.toBe('obfuscated@example.com');
    });

    it('ANAL-009 — orders by ClientFavorite.createdAt descending', async () => {
      const older = await Client.create({
        name: 'Older Fav',
        email: 'older-fav@example.com',
        status: 'active'
      });
      const newer = await Client.create({
        name: 'Newer Fav',
        email: 'newer-fav@example.com',
        status: 'active'
      });
      await ClientFavorite.create({ userId, clientId: older.id });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await ClientFavorite.create({ userId, clientId: newer.id });

      const res = await request(app)
        .get('/api/clients/favorites')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([
        newer.id,
        older.id
      ]);
    });

    it('only returns favorites belonging to the requesting user', async () => {
      const client = await Client.create({
        name: 'Someone Else Fav',
        email: 'someoneelse@example.com',
        status: 'active'
      });
      await ClientFavorite.create({ userId: adminId, clientId: client.id });

      const res = await request(app)
        .get('/api/clients/favorites')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/clients/favorites vs GET /api/clients/:id (ANAL-003)', () => {
    it('does not collide with the :id route — "favorites" is never parsed as an ObjectId', async () => {
      const res = await request(app)
        .get('/api/clients/favorites')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
