import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Client from '../models/client';
import ClientService, { escapeRegex } from './ClientService';

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

  describe('list with search (WI-API-CLIENTE-BUSQUEDA-001)', () => {
    it('AC-01 — finds by name case-insensitively', async () => {
      await Client.create([
        { name: 'Ana Garcia', email: 'ana@example.com', status: 'active' },
        { name: 'Carlos', email: 'carlos@example.com', status: 'active' },
        { name: 'Banana', email: 'banana@example.com', status: 'active' }
      ]);

      const result = await ClientService.list({
        page: 1,
        limit: 20,
        status: 'active',
        search: 'ANA'
      });

      expect(result.total).toBe(2);
      expect(result.items.map((c) => c.name).sort()).toEqual(['Ana Garcia', 'Banana'].sort());
    });

    it('AC-06 — returns empty list when no match', async () => {
      await Client.create([
        { name: 'Carlos', email: 'carlos@example.com', status: 'active' }
      ]);

      const result = await ClientService.list({
        page: 1,
        limit: 20,
        status: 'active',
        search: 'zzznomatch'
      });

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('AC-02 / RN-01 — treats ".*" as a literal search, not a regex wildcard', async () => {
      await Client.create([
        { name: 'Ana', email: 'ana@example.com', status: 'active' },
        { name: 'Ana.*Perez', email: 'aperez@example.com', status: 'active' }
      ]);

      const result = await ClientService.list({
        page: 1,
        limit: 20,
        status: 'active',
        search: '.*'
      });

      // Only the client whose name literally contains ".*"
      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Ana.*Perez');
    });

    it('AC-07 / RN-04 — does not search in email field', async () => {
      await Client.create([
        { name: 'Luis', email: 'ana@example.com', status: 'active' }
      ]);

      const result = await ClientService.list({
        page: 1,
        limit: 20,
        status: 'active',
        search: 'ana'
      });

      // "ana" is in the email but not in the name "Luis"
      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('AC-08 — pagination and total count apply only to matching documents', async () => {
      const matching = Array.from({ length: 25 }, (_, i) => ({
        name: `Ana Client ${i + 1}`,
        email: `ana${i + 1}@example.com`,
        status: 'active' as const
      }));
      const nonMatching = Array.from({ length: 5 }, (_, i) => ({
        name: `Other Client ${i + 1}`,
        email: `other${i + 1}@example.com`,
        status: 'active' as const
      }));

      await Client.create([...matching, ...nonMatching]);

      const result = await ClientService.list({
        page: 2,
        limit: 10,
        status: 'active',
        search: 'ana'
      });

      expect(result.total).toBe(25);
      expect(result.items).toHaveLength(10);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.items.every((c) => /ana/i.test(c.name))).toBe(true);
    });

    it('AC-05 — without search returns all items unchanged', async () => {
      await Client.create([
        { name: 'Alice', email: 'alice@example.com', status: 'active' },
        { name: 'Bob', email: 'bob@example.com', status: 'active' }
      ]);

      const result = await ClientService.list({
        page: 1,
        limit: 20,
        status: 'active'
      });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
    });
  });
});

// escapeRegex is a pure function — no MongoDB needed
describe('escapeRegex (RN-01)', () => {
  it('escapes dot and star so they match literally', () => {
    expect(escapeRegex('.')).toBe('\\.');
    expect(escapeRegex('*')).toBe('\\*');
  });

  it('escapes plus, question mark, caret', () => {
    expect(escapeRegex('+')).toBe('\\+');
    expect(escapeRegex('?')).toBe('\\?');
    expect(escapeRegex('^')).toBe('\\^');
  });

  it('escapes curly braces, parentheses, pipe', () => {
    expect(escapeRegex('{')).toBe('\\{');
    expect(escapeRegex('}')).toBe('\\}');
    expect(escapeRegex('(')).toBe('\\(');
    expect(escapeRegex(')')).toBe('\\)');
    expect(escapeRegex('|')).toBe('\\|');
  });

  it('escapes square brackets and backslash', () => {
    expect(escapeRegex('[')).toBe('\\[');
    expect(escapeRegex(']')).toBe('\\]');
    expect(escapeRegex('\\')).toBe('\\\\');
  });

  it('escapes the dollar sign', () => {
    const dollar = String.fromCharCode(36);
    const escaped = escapeRegex(dollar);
    expect(escaped).toBe('\\' + dollar);
  });

  it('escapes ".*" so the resulting regex matches that literal sequence', () => {
    const escaped = escapeRegex('.*');
    const rx = new RegExp(escaped, 'i');

    // Matches the literal two-character sequence
    expect(rx.test('foo.*bar')).toBe(true);
    // Does NOT match an arbitrary string (dot is not a wildcard)
    expect(rx.test('foobar')).toBe(false);
    expect(rx.test('fooxbar')).toBe(false);
  });

  it('leaves plain alphanumeric text unchanged', () => {
    expect(escapeRegex('Ana')).toBe('Ana');
    expect(escapeRegex('hello world')).toBe('hello world');
    expect(escapeRegex('Jose')).toBe('Jose');
  });

  it('escapes mixed input correctly', () => {
    expect(escapeRegex('a.b*c')).toBe('a\\.b\\*c');
    expect(escapeRegex('[test]')).toBe('\\[test\\]');
  });
});
