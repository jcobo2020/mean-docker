import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import User from '../models/user';
import Client from '../models/client';
import env from '../config/env';
import { obfuscateValue } from '../lib/obfuscate';

describe('Clients API (WI-CLI-001-P1)', () => {
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

    it('valid JWT for deleted user returns 401', async () => {
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
});
