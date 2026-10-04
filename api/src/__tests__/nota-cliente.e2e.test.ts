/**
 * E2E · WI-FN-NOTA-CLIENTE-001 — la nota interna del cliente, de punta a punta.
 *
 * Integra tres specs activas (MEAN-FN-NOTA-CLIENTE-001 declara cómo encajan):
 *   - MEAN-API-NOTA-CLIENTE-001: PATCH /api/clients/:id/note, body { internalNote: string | null },
 *     200 con el cliente completo, 400 (> 280 o :id inválido), 401, 404.
 *   - MEAN-DM-NOTA-CLIENTE-001: campo internalNote (String, opcional, maxLength 280, default null) en clients.
 *   - MEAN-UX-NOTA-CLIENTE-001: la pantalla /clients edita la nota y la lee de vuelta.
 * Y dos reglas del agrupador:
 *   - RN-02: el listado (toPublicClient) NO trae la nota; se lee en el detalle.
 *   - un cliente previo, sin la clave, se lee con internalNote null.
 *
 * El flujo es el de la pantalla: guardar → leer en el detalle → vaciar. No sustituye a los
 * tests unitarios de cada capa, que viven en su spec.
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import User from '../models/user';
import Client from '../models/client';
import env from '../config/env';

describe('E2E · nota interna del cliente (WI-FN-NOTA-CLIENTE-001)', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();
  let token: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    const user = await User.create({
      firstName: 'Nota', lastName: 'E2E', username: 'nota-e2e', password: 'secret', role: 'user'
    });
    token = jwt.sign({ sub: user.id }, env.secret, { algorithm: 'HS256' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Client.deleteMany({});
  });

  const nuevoCliente = () =>
    Client.create({ name: 'Acme', email: 'acme-nota@acme.com', status: 'active' });
  const patch = (id: string, body: unknown) =>
    request(app).patch(`/api/clients/${id}/note`).set('Authorization', `Bearer ${token}`).send(body as object);
  const detalle = (id: string) =>
    request(app).get(`/api/clients/${id}`).set('Authorization', `Bearer ${token}`);

  it('un cliente previo, sin la clave, se lee con internalNote null (DM)', async () => {
    const c = await nuevoCliente();
    const res = await detalle(c.id);
    expect(res.status).toBe(200);
    expect(res.body.data.internalNote).toBeNull();
  });

  it('guardar la nota la devuelve y el detalle la lee de vuelta (API + DM + flujo de la pantalla)', async () => {
    const c = await nuevoCliente();
    const guardado = await patch(c.id, { internalNote: 'Llamar el lunes' });
    expect(guardado.status).toBe(200);
    expect(guardado.body.data.internalNote).toBe('Llamar el lunes');

    const leido = await detalle(c.id);
    expect(leido.body.data.internalNote).toBe('Llamar el lunes');
  });

  it('la nota se sobrescribe, no se acumula', async () => {
    const c = await nuevoCliente();
    await patch(c.id, { internalNote: 'primera' });
    const res = await patch(c.id, { internalNote: 'segunda' });
    expect(res.body.data.internalNote).toBe('segunda');
  });

  it('el listado no trae la nota: se lee en el detalle (RN-02)', async () => {
    const c = await nuevoCliente();
    await patch(c.id, { internalNote: 'privada del equipo' });
    const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).not.toHaveProperty('internalNote');
  });

  it('vaciar con null o con texto vacío deja internalNote null', async () => {
    const c = await nuevoCliente();
    await patch(c.id, { internalNote: 'algo' });
    expect((await patch(c.id, { internalNote: null })).body.data.internalNote).toBeNull();
    await patch(c.id, { internalNote: 'otra vez' });
    expect((await patch(c.id, { internalNote: '' })).body.data.internalNote).toBeNull();
  });

  it('280 caracteres se aceptan; 281 dan 400 con el campo nombrado', async () => {
    const c = await nuevoCliente();
    expect((await patch(c.id, { internalNote: 'x'.repeat(280) })).status).toBe(200);
    const largo = await patch(c.id, { internalNote: 'x'.repeat(281) });
    expect(largo.status).toBe(400);
    expect(largo.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'internalNote' })]));
  });

  it(':id que no es un ObjectId → 400; cliente que no existe → 404', async () => {
    expect((await patch('no-es-un-id', { internalNote: 'x' })).status).toBe(400);
    const otro = new mongoose.Types.ObjectId().toString();
    expect((await patch(otro, { internalNote: 'x' })).status).toBe(404);
  });

  it('sin token → 401, como el resto de /api/clients', async () => {
    const c = await nuevoCliente();
    const res = await request(app).patch(`/api/clients/${c.id}/note`).send({ internalNote: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });
});
