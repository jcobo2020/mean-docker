import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import User from '../models/user';
import Client from '../models/client';
import env from '../config/env';
import { obfuscateValue } from '../lib/obfuscate';

describe('Clients API (WI-CLI-001)', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();
  let adminToken: string;
  let userToken: string;
  let deletedUserToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      username: 'admin',
      password: 'secret',
      role: 'admin'
    });
    const regular = await User.create({
      firstName: 'Regular',
      lastName: 'User',
      username: 'regular',
      password: 'secret',
      role: 'user'
    });
    const deletedId = new mongoose.Types.ObjectId();

    adminToken = jwt.sign({ sub: admin.id }, env.secret, { algorithm: 'HS256' });
    userToken = jwt.sign({ sub: regular.id }, env.secret, { algorithm: 'HS256' });
    deletedUserToken = jwt.sign({ sub: deletedId.toString() }, env.secret, {
      algorithm: 'HS256'
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Client.deleteMany({});
  });

  describe('RN-03 — JWT required', () => {
    it('POST /api/clients without token returns 401', async () => {
      const res = await request(app).post('/api/clients').send({
        name: 'Acme',
        email: 'acme@example.com'
      });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        status: 'error',
        message: expect.any(String)
      });
    });

    it('GET /api/clients without token returns 401', async () => {
      const res = await request(app).get('/api/clients');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        status: 'error',
        message: expect.any(String)
      });
    });

    it('GET /api/clients/:id without token returns 401', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(`/api/clients/${id}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('DELETE /api/clients/:id without token returns 401', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app).delete(`/api/clients/${id}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('invalid token returns 401', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', 'Bearer invalid.token.here')
        .send({ name: 'Acme', email: 'acme@example.com' });
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('valid JWT for deleted user returns 401 on GET list', async () => {
      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${deletedUserToken}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('valid JWT for deleted user returns 401 on POST', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${deletedUserToken}`)
        .send({ name: 'Acme', email: 'acme@example.com' });
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });

  describe('RN-06 / AC-06 — admin only', () => {
    it('POST /api/clients by non-admin returns 403', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Acme', email: 'acme@example.com' });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        status: 'error',
        message: expect.any(String)
      });
    });

    it('non-admin gets 403 before validation (empty body)', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('DELETE /api/clients/:id by non-admin returns 403', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/clients/${id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
    });
  });

  describe('POST /api/clients', () => {
    it('creates client with 201 and obfuscated PII (RN-07)', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Acme Corp',
          email: '  Admin@Acme.COM  ',
          phone: '+14155552671'
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toEqual(expect.any(String));
      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        name: 'Acme Corp',
        email: obfuscateValue('admin@acme.com'),
        phone: obfuscateValue('+14155552671'),
        status: 'active',
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
      expect(res.body.data.email).not.toBe('admin@acme.com');
      expect(res.body.data.phone).not.toBe('+14155552671');
      expect(res.body.data).not.toHaveProperty('_id');
      expect(res.body.data).not.toHaveProperty('__v');

      const stored = await Client.findById(res.body.data.id);
      expect(stored!.email).toBe('admin@acme.com');
      expect(stored!.phone).toBe('+14155552671');
    });

    it('does not persist phone when absent, null, or empty', async () => {
      const absent = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No Phone', email: 'nophone@acme.com' });
      expect(absent.status).toBe(201);
      expect(absent.body.data).not.toHaveProperty('phone');
      expect((await Client.findById(absent.body.data.id))!.phone).toBeUndefined();

      const empty = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Empty Phone', email: 'empty@acme.com', phone: '' });
      expect(empty.status).toBe(201);
      expect(empty.body.data).not.toHaveProperty('phone');

      const nullPhone = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Null Phone', email: 'null@acme.com', phone: null });
      expect(nullPhone.status).toBe(201);
      expect(nullPhone.body.data).not.toHaveProperty('phone');
    });

    it('returns 400 for validation errors', async () => {
      const badEmail = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Acme', email: 'not-an-email' });
      expect(badEmail.status).toBe(400);
      expect(badEmail.body.status).toBe('error');

      const badPhone = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Acme', email: 'ok@acme.com', phone: '555-1234' });
      expect(badPhone.status).toBe(400);
      expect(badPhone.body.status).toBe('error');

      const missingName = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'ok2@acme.com' });
      expect(missingName.status).toBe(400);
    });

    it('returns 409 for duplicate email', async () => {
      await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'First', email: 'dup@acme.com' });

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Second', email: 'DUP@acme.com' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        status: 'error',
        message: expect.any(String)
      });
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('soft-deletes and returns 200 with inactive status (AC-04)', async () => {
      const created = await Client.create({
        name: 'To Delete',
        email: 'delete@acme.com',
        phone: '+14155552671',
        status: 'active'
      });

      const res = await request(app)
        .delete(`/api/clients/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe('inactive');
      expect(res.body.data.email).toBe(obfuscateValue('delete@acme.com'));
      expect(res.body.data.phone).toBe(obfuscateValue('+14155552671'));

      const row = await Client.findById(created.id);
      expect(row).not.toBeNull();
      expect(row!.status).toBe('inactive');
    });

    it('is idempotent without write when already inactive', async () => {
      const created = await Client.create({
        name: 'Already Inactive',
        email: 'inactive@acme.com',
        status: 'inactive'
      });
      const previousUpdatedAt = created.updatedAt.getTime();

      await new Promise((resolve) => setTimeout(resolve, 20));

      const res = await request(app)
        .delete(`/api/clients/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('inactive');

      const reloaded = await Client.findById(created.id);
      expect(reloaded!.updatedAt.getTime()).toBe(previousUpdatedAt);
    });

    it('returns 400 for invalid ObjectId', async () => {
      const res = await request(app)
        .delete('/api/clients/not-an-objectid')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('returns 404 when client does not exist', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/clients/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });
  });

  describe('GET /api/clients (WI-CLI-001-P2)', () => {
    it('RN-01 / AC-01 — default list returns only active clients', async () => {
      await Client.create([
        {
          name: 'Active One',
          email: 'active1@acme.com',
          phone: '+14155552671',
          status: 'active'
        },
        {
          name: 'Inactive One',
          email: 'inactive1@acme.com',
          status: 'inactive'
        },
        {
          name: 'Active Two',
          email: 'active2@acme.com',
          status: 'active'
        }
      ]);

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(20);
      expect(res.body.data.items).toHaveLength(2);
      expect(
        res.body.data.items.every(
          (item: { status: string }) => item.status === 'active'
        )
      ).toBe(true);
      expect(
        res.body.data.items.map((item: { name: string }) => item.name)
      ).not.toContain('Inactive One');
    });

    it('status=active explicit matches default list', async () => {
      await Client.create([
        { name: 'Active', email: 'active@acme.com', status: 'active' },
        { name: 'Inactive', email: 'inactive@acme.com', status: 'inactive' }
      ]);

      const withoutFilter = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${userToken}`);
      const withActive = await request(app)
        .get('/api/clients?status=active')
        .set('Authorization', `Bearer ${userToken}`);

      expect(withoutFilter.status).toBe(200);
      expect(withActive.status).toBe(200);
      expect(withActive.body.data.total).toBe(withoutFilter.body.data.total);
      expect(withActive.body.data.items.map((item: { id: string }) => item.id)).toEqual(
        withoutFilter.body.data.items.map((item: { id: string }) => item.id)
      );
    });

    it('RN-02 / AC-02 — non-admin with status=inactive receives 403 CLIENTS_FORBIDDEN_FILTER', async () => {
      const res = await request(app)
        .get('/api/clients?status=inactive')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        status: 'error',
        message: 'CLIENTS_FORBIDDEN_FILTER'
      });
    });

    it('authorization wins over invalid pagination for status=inactive (D3)', async () => {
      const res = await request(app)
        .get('/api/clients?status=inactive&page=0&limit=999')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('CLIENTS_FORBIDDEN_FILTER');
    });

    it('admin can list inactive clients', async () => {
      await Client.create([
        { name: 'Active', email: 'active@acme.com', status: 'active' },
        {
          name: 'Inactive',
          email: 'inactive@acme.com',
          phone: '+14155552671',
          status: 'inactive'
        }
      ]);

      const res = await request(app)
        .get('/api/clients?status=inactive')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].status).toBe('inactive');
      expect(res.body.data.items[0].email).toBe(obfuscateValue('inactive@acme.com'));
      expect(res.body.data.items[0].phone).toBe(obfuscateValue('+14155552671'));
      expect(res.body.data.items[0].email).not.toBe('inactive@acme.com');
    });

    it('returns 200 with deterministic order and pagination', async () => {
      const older = await Client.create({
        name: 'Older',
        email: 'older@acme.com',
        status: 'active',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z')
      });
      const newer = await Client.create({
        name: 'Newer',
        email: 'newer@acme.com',
        status: 'active',
        createdAt: new Date('2024-06-01T00:00:00.000Z'),
        updatedAt: new Date('2024-06-01T00:00:00.000Z')
      });
      const sameTimeFirst = await Client.create({
        name: 'Same Time First',
        email: 'same-first@acme.com',
        status: 'active',
        createdAt: new Date('2024-03-01T00:00:00.000Z'),
        updatedAt: new Date('2024-03-01T00:00:00.000Z')
      });
      const sameTimeSecond = await Client.create({
        name: 'Same Time Second',
        email: 'same-second@acme.com',
        status: 'active',
        createdAt: new Date('2024-03-01T00:00:00.000Z'),
        updatedAt: new Date('2024-03-01T00:00:00.000Z')
      });

      const tieBreakOrder = [sameTimeFirst.id, sameTimeSecond.id].sort().reverse();
      const expectedOrder = [newer.id, ...tieBreakOrder, older.id];

      const page1 = await request(app)
        .get('/api/clients?page=1&limit=2')
        .set('Authorization', `Bearer ${userToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.data.total).toBe(4);
      expect(page1.body.data.page).toBe(1);
      expect(page1.body.data.limit).toBe(2);
      expect(page1.body.data.items.map((item: { id: string }) => item.id)).toEqual(
        expectedOrder.slice(0, 2)
      );
      expect(page1.body.data.items[0].email).toBe(obfuscateValue('newer@acme.com'));

      const page2 = await request(app)
        .get('/api/clients?page=2&limit=2')
        .set('Authorization', `Bearer ${userToken}`);

      expect(page2.status).toBe(200);
      expect(page2.body.data.items.map((item: { id: string }) => item.id)).toEqual(
        expectedOrder.slice(2, 4)
      );
    });

    it('returns 400 for invalid pagination params', async () => {
      const cases = [
        '/api/clients?page=abc',
        '/api/clients?page=0',
        '/api/clients?limit=0',
        '/api/clients?limit=51',
        '/api/clients?limit=xyz'
      ];

      for (const url of cases) {
        const res = await request(app)
          .get(url)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          status: 'error',
          message: expect.any(String)
        });
      }
    });

    it('returns 400 for invalid status enum (D2)', async () => {
      const res = await request(app)
        .get('/api/clients?status=foo')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });
  });

  describe('GET /api/clients/:id (WI-CLI-001-P2)', () => {
    it('returns 200 with obfuscated PII for active client', async () => {
      const created = await Client.create({
        name: 'Detail Client',
        email: 'detail@acme.com',
        phone: '+14155552671',
        status: 'active'
      });

      const res = await request(app)
        .get(`/api/clients/${created.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toMatchObject({
        id: created.id,
        name: 'Detail Client',
        email: obfuscateValue('detail@acme.com'),
        phone: obfuscateValue('+14155552671'),
        status: 'active',
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
      expect(res.body.data.email).not.toBe('detail@acme.com');
      expect(res.body.data).not.toHaveProperty('_id');
      expect(res.body.data).not.toHaveProperty('__v');
    });

    it('RN-05 / AC-05 — non-admin gets 404 for inactive client', async () => {
      const created = await Client.create({
        name: 'Hidden Inactive',
        email: 'hidden@acme.com',
        status: 'inactive'
      });

      const res = await request(app)
        .get(`/api/clients/${created.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        status: 'error',
        message: expect.any(String)
      });
    });

    it('admin can retrieve inactive client', async () => {
      const created = await Client.create({
        name: 'Admin Visible',
        email: 'admin-visible@acme.com',
        status: 'inactive'
      });

      const res = await request(app)
        .get(`/api/clients/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('inactive');
      expect(res.body.data.email).toBe(obfuscateValue('admin-visible@acme.com'));
    });

    it('returns 404 when client does not exist', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/clients/${id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });

    it('returns 400 for invalid ObjectId', async () => {
      const res = await request(app)
        .get('/api/clients/not-an-objectid')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });
  });

  describe('POST /api/clients/:id/reactivate (WI-API-CLIENTE-REACTIVAR-001)', () => {
    it('AC-01 — reactivates an inactive client and returns 200 with active status', async () => {
      const created = await Client.create({
        name: 'Inactive Client',
        email: 'reactivate@acme.com',
        phone: '+14155552671',
        status: 'inactive'
      });

      const res = await request(app)
        .post(`/api/clients/${created.id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toMatchObject({
        id: created.id,
        name: 'Inactive Client',
        email: obfuscateValue('reactivate@acme.com'),
        phone: obfuscateValue('+14155552671'),
        status: 'active',
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
      expect(res.body.data).not.toHaveProperty('_id');
      expect(res.body.data).not.toHaveProperty('__v');

      const row = await Client.findById(created.id);
      expect(row!.status).toBe('active');
    });

    it('AC-01 — is idempotent: reactivating an already active client returns 200 with active status', async () => {
      const created = await Client.create({
        name: 'Already Active',
        email: 'alreadyactive@acme.com',
        status: 'active'
      });
      const previousUpdatedAt = created.updatedAt.getTime();

      await new Promise((resolve) => setTimeout(resolve, 20));

      const res = await request(app)
        .post(`/api/clients/${created.id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe('active');

      const reloaded = await Client.findById(created.id);
      expect(reloaded!.updatedAt.getTime()).toBe(previousUpdatedAt);
    });

    it('AC-02 — returns 404 when client does not exist', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/clients/${id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        status: 'error',
        message: expect.any(String)
      });
    });

    it('AC-03 / RN-01 — non-admin returns 403 without modifying client status', async () => {
      const created = await Client.create({
        name: 'Protected Client',
        email: 'protected@acme.com',
        status: 'inactive'
      });

      const res = await request(app)
        .post(`/api/clients/${created.id}/reactivate`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        status: 'error',
        message: expect.any(String)
      });

      const row = await Client.findById(created.id);
      expect(row!.status).toBe('inactive');
    });

    it('returns 401 when no token is provided', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/clients/${id}/reactivate`);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('returns 400 for invalid ObjectId', async () => {
      const res = await request(app)
        .post('/api/clients/not-an-objectid/reactivate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });
  });

  describe('GET /api/clients?search= (WI-API-CLIENTE-BUSQUEDA-001)', () => {
    // AC-01: finds by name case-insensitively
    it('AC-01 — returns active clients whose name contains the search term (case-insensitive)', async () => {
      await Client.create([
        { name: 'Ana García', email: 'ana@acme.com', status: 'active' },
        { name: 'Carlos', email: 'carlos@acme.com', status: 'active' },
        { name: 'Banana', email: 'banana@acme.com', status: 'active' }
      ]);

      const res = await request(app)
        .get('/api/clients?search=ANA')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.total).toBe(2);
      const names = res.body.data.items.map((i: { name: string }) => i.name).sort();
      expect(names).toEqual(['Ana García', 'Banana'].sort());
    });

    // AC-05: without search, list is unchanged
    it('AC-05 — without search, returns full list with correct ids and total', async () => {
      const c1 = await Client.create({ name: 'Alpha', email: 'alpha@acme.com', status: 'active' });
      const c2 = await Client.create({ name: 'Beta', email: 'beta@acme.com', status: 'active' });

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      const ids = res.body.data.items.map((i: { id: string }) => i.id);
      expect(ids).toContain(c1.id);
      expect(ids).toContain(c2.id);
    });

    // AC-06: no match is not an error
    it('AC-06 — no coincidences returns 200 with items [] and total 0', async () => {
      await Client.create({ name: 'Carlos', email: 'carlos@acme.com', status: 'active' });

      const res = await request(app)
        .get('/api/clients?search=zzznomatch')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(20);
    });

    // AC-08: pagination counts only matching documents
    it('AC-08 — total and pagination count only matching documents', async () => {
      const matching = Array.from({ length: 25 }, (_, i) => ({
        name: `Ana Client ${String(i + 1).padStart(2, '0')}`,
        email: `ana${i + 1}@acme.com`,
        status: 'active'
      }));
      const nonMatching = Array.from({ length: 5 }, (_, i) => ({
        name: `Other Client ${i + 1}`,
        email: `other${i + 1}@acme.com`,
        status: 'active'
      }));
      await Client.create([...matching, ...nonMatching]);

      const res = await request(app)
        .get('/api/clients?search=ana&page=2&limit=10')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(25);
      expect(res.body.data.items).toHaveLength(10);
      expect(res.body.data.page).toBe(2);
      expect(res.body.data.limit).toBe(10);
      // All returned items must match the search term
      expect(
        res.body.data.items.every((i: { name: string }) => /ana/i.test(i.name))
      ).toBe(true);
    });

    // AC-02 / RN-01: literal search — ".*" is not a wildcard
    it('AC-02 / RN-01 — ".*" is treated as a literal, not a regex wildcard', async () => {
      await Client.create([
        { name: 'Ana', email: 'ana@acme.com', status: 'active' },
        { name: 'Ana.*Pérez', email: 'aperez@acme.com', status: 'active' }
      ]);

      const res = await request(app)
        .get('/api/clients?search=.*')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].name).toBe('Ana.*Pérez');
    });

    // AC-03 / RN-02: out-of-range search returns 400
    it('AC-03 / RN-02 — search=a (1 char) returns 400 with explicit message', async () => {
      const res = await request(app)
        .get('/api/clients?search=a')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        status: 'error',
        message: 'search must be between 2 and 100 characters'
      });
    });

    it('AC-03 / RN-02 — search of only spaces (after trim = empty) returns 400', async () => {
      const res = await request(app)
        .get('/api/clients?search=%20%20%20')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        status: 'error',
        message: 'search must be between 2 and 100 characters'
      });
    });

    it('AC-03 / RN-02 — search of 101 characters returns 400', async () => {
      const longSearch = 'a'.repeat(101);
      const res = await request(app)
        .get(`/api/clients?search=${longSearch}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        status: 'error',
        message: 'search must be between 2 and 100 characters'
      });
    });

    // AC-04 / RN-03: non-admin requesting inactive gets 403 even with search
    it('AC-04 / RN-03 — non-admin with search=ana&status=inactive returns 403', async () => {
      const res = await request(app)
        .get('/api/clients?search=ana&status=inactive')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        status: 'error',
        message: 'CLIENTS_FORBIDDEN_FILTER'
      });
    });

    it('AC-04 / RN-03 — non-admin with search=a (invalid) &status=inactive returns 403 (auth wins)', async () => {
      const res = await request(app)
        .get('/api/clients?search=a&status=inactive')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        status: 'error',
        message: 'CLIENTS_FORBIDDEN_FILTER'
      });
    });

    // Admin with invalid search + status=inactive → 400 (validation acts)
    it('RN-03 — admin with search=a&status=inactive returns 400 (validation acts for admin)', async () => {
      const res = await request(app)
        .get('/api/clients?search=a&status=inactive')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        status: 'error',
        message: 'search must be between 2 and 100 characters'
      });
    });

    // AC-07 / RN-04: search only in name, not email
    it('AC-07 / RN-04 — search term found only in email does not return the client', async () => {
      await Client.create({ name: 'Luis', email: 'ana@example.com', status: 'active' });

      const res = await request(app)
        .get('/api/clients?search=ana')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.items).toHaveLength(0);
    });

    // search=100 chars exactly → valid
    it('search of exactly 100 characters returns 200', async () => {
      const search100 = 'a'.repeat(100);
      const res = await request(app)
        .get(`/api/clients?search=${search100}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    // search=2 chars exactly → valid
    it('search of exactly 2 characters returns 200', async () => {
      await Client.create({ name: 'al', email: 'al@acme.com', status: 'active' });

      const res = await request(app)
        .get('/api/clients?search=al')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
    });

    // results are ordered createdAt desc, _id desc
    it('results with search are ordered createdAt desc, _id desc', async () => {
      const older = await Client.create({
        name: 'Ana Older',
        email: 'ana-older@acme.com',
        status: 'active',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z')
      });
      const newer = await Client.create({
        name: 'Ana Newer',
        email: 'ana-newer@acme.com',
        status: 'active',
        createdAt: new Date('2024-06-01T00:00:00.000Z'),
        updatedAt: new Date('2024-06-01T00:00:00.000Z')
      });

      const res = await request(app)
        .get('/api/clients?search=ana')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].id).toBe(newer.id);
      expect(res.body.data.items[1].id).toBe(older.id);
    });

    // Items in search response are PublicClient (obfuscated PII)
    it('items in search response have obfuscated email and phone', async () => {
      await Client.create({
        name: 'Ana Test',
        email: 'ana@acme.com',
        phone: '+14155552671',
        status: 'active'
      });

      const res = await request(app)
        .get('/api/clients?search=ana')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].email).toBe(obfuscateValue('ana@acme.com'));
      expect(res.body.data.items[0].phone).toBe(obfuscateValue('+14155552671'));
      expect(res.body.data.items[0].email).not.toBe('ana@acme.com');
    });
  });

  describe('GET /api/clients/count (WI-API-CLIENTE-CONTEO-001)', () => {
    it('AC-04 / RN-01 — returns 401 without token', async () => {
      const res = await request(app).get('/api/clients/count');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/clients/count')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });

    it('AC-01 — returns 200 with total of all clients when no status filter given', async () => {
      await Client.create([
        { name: 'Active One', email: 'active1@acme.com', status: 'active' },
        { name: 'Active Two', email: 'active2@acme.com', status: 'active' },
        { name: 'Inactive One', email: 'inactive1@acme.com', status: 'inactive' }
      ]);

      const res = await request(app)
        .get('/api/clients/count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 3 });
    });

    it('AC-01 — returns 200 with total=0 when there are no clients', async () => {
      const res = await request(app)
        .get('/api/clients/count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 0 });
    });

    it('AC-02 — returns 200 with count of active clients when status=active', async () => {
      await Client.create([
        { name: 'Active One', email: 'active1@acme.com', status: 'active' },
        { name: 'Active Two', email: 'active2@acme.com', status: 'active' },
        { name: 'Inactive One', email: 'inactive1@acme.com', status: 'inactive' }
      ]);

      const res = await request(app)
        .get('/api/clients/count?status=active')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 2 });
    });

    it('returns 200 with count of inactive clients when status=inactive', async () => {
      await Client.create([
        { name: 'Active One', email: 'active1@acme.com', status: 'active' },
        { name: 'Inactive One', email: 'inactive1@acme.com', status: 'inactive' },
        { name: 'Inactive Two', email: 'inactive2@acme.com', status: 'inactive' }
      ]);

      const res = await request(app)
        .get('/api/clients/count?status=inactive')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 2 });
    });

    it('AC-03 / RN-02 — returns 400 with errors array for invalid status value', async () => {
      const res = await request(app)
        .get('/api/clients/count?status=loquesea')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors[0]).toMatchObject({
        msg: expect.any(String),
        path: 'status'
      });
    });

    it('AC-03 / RN-02 — returns 400 for status=foo without executing count', async () => {
      const res = await request(app)
        .get('/api/clients/count?status=foo')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });

    it('response body has only the total field (no pagination, no items)', async () => {
      await Client.create([
        { name: 'Active One', email: 'active1@acme.com', status: 'active' }
      ]);

      const res = await request(app)
        .get('/api/clients/count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['total']);
      expect(typeof res.body.total).toBe('number');
      expect(res.body.total).toBeGreaterThanOrEqual(0);
      expect(res.body).not.toHaveProperty('page');
      expect(res.body).not.toHaveProperty('limit');
      expect(res.body).not.toHaveProperty('items');
    });

    it('regular user (non-admin) can access count without 403', async () => {
      const res = await request(app)
        .get('/api/clients/count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
    });
  });
});
