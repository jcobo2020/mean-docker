/**
 * Integration tests — GET /api/clients/count
 * Work Item: WI-API-CLIENTE-CONTEO-001
 *
 * Covers:
 *   AC-01 — Sin filtro devuelve el total de clientes
 *   AC-02 — Con status=active cuenta solo los activos
 *   AC-03 — Un status inválido se rechaza con 400 (RN-02)
 *   AC-04 — Sin token no se responde (RN-01)
 *
 * DoD gates:
 *   [RN-01] GET /api/clients/count sin token → 401
 *   [RN-02] GET /api/clients/count?status=loquesea → 400
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import User from '../models/user';
import Client from '../models/client';
import env from '../config/env';

describe('GET /api/clients/count — WI-API-CLIENTE-CONTEO-001', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();
  let userToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const regular = await User.create({
      firstName: 'Regular',
      lastName: 'User',
      username: 'count-regular',
      password: 'secret',
      role: 'user'
    });

    userToken = jwt.sign({ sub: regular.id }, env.secret, { algorithm: 'HS256' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Client.deleteMany({});
  });

  // ── DoD gate [RN-01] ─────────────────────────────────────────────────────────
  describe('[RN-01] Authentication required', () => {
    it('AC-04 — returns 401 when no Authorization header is sent', async () => {
      const res = await request(app).get('/api/clients/count');
      expect(res.status).toBe(401);
    });

    it('returns 401 when an invalid Bearer token is sent', async () => {
      const res = await request(app)
        .get('/api/clients/count')
        .set('Authorization', 'Bearer invalid.jwt.token');
      expect(res.status).toBe(401);
    });
  });

  // ── DoD gate [RN-02] ─────────────────────────────────────────────────────────
  describe('[RN-02] Invalid status is rejected before counting', () => {
    it('AC-03 — returns 400 for status=loquesea (exact DoD example)', async () => {
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

    it('AC-03 — returns 400 for status=foo without running a count', async () => {
      const res = await request(app)
        .get('/api/clients/count?status=foo')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });

    it('AC-03 — returns 400 for status=ALL (mixed case)', async () => {
      const res = await request(app)
        .get('/api/clients/count?status=ALL')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });
  });

  // ── AC-01 — No filter: count all clients ─────────────────────────────────────
  describe('AC-01 — No filter returns total of all clients', () => {
    it('returns { total: 0 } when no clients exist', async () => {
      const res = await request(app)
        .get('/api/clients/count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 0 });
    });

    it('returns { total: N } equal to the number of existing clients (both statuses)', async () => {
      await Client.create([
        { name: 'Active One', email: 'active1@count.com', status: 'active' },
        { name: 'Active Two', email: 'active2@count.com', status: 'active' },
        { name: 'Inactive One', email: 'inactive1@count.com', status: 'inactive' }
      ]);

      const res = await request(app)
        .get('/api/clients/count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 3 });
    });

    it('response body has exactly one field: total (no page, limit, items)', async () => {
      await Client.create([
        { name: 'Only Active', email: 'only@count.com', status: 'active' }
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
  });

  // ── AC-02 — Filter by status=active ──────────────────────────────────────────
  describe('AC-02 — status=active counts only active clients', () => {
    it('returns { total: 2 } when 2 active and 1 inactive client exist', async () => {
      await Client.create([
        { name: 'Active One', email: 'a1@count.com', status: 'active' },
        { name: 'Active Two', email: 'a2@count.com', status: 'active' },
        { name: 'Inactive One', email: 'i1@count.com', status: 'inactive' }
      ]);

      const res = await request(app)
        .get('/api/clients/count?status=active')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 2 });
    });

    it('returns { total: 0 } when no active clients exist', async () => {
      await Client.create([
        { name: 'Inactive Only', email: 'i_only@count.com', status: 'inactive' }
      ]);

      const res = await request(app)
        .get('/api/clients/count?status=active')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 0 });
    });

    it('status=inactive counts only inactive clients', async () => {
      await Client.create([
        { name: 'Active One', email: 'act@count.com', status: 'active' },
        { name: 'Inactive One', email: 'inact1@count.com', status: 'inactive' },
        { name: 'Inactive Two', email: 'inact2@count.com', status: 'inactive' }
      ]);

      const res = await request(app)
        .get('/api/clients/count?status=inactive')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 2 });
    });
  });

  // ── Access control — no admin required ───────────────────────────────────────
  describe('Access control', () => {
    it('a regular (non-admin) user can access the count endpoint (no requireAdmin)', async () => {
      const res = await request(app)
        .get('/api/clients/count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
    });
  });
});
