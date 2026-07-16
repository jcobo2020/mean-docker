import Client, { ClientStatus, IClient } from '../models/client';

export interface CreateClientInput {
  name: string;
  email: string;
  phone?: string;
}

export interface ListClientsInput {
  page: number;
  limit: number;
  status: ClientStatus;
}

export interface ListClientsResult {
  items: IClient[];
  total: number;
  page: number;
  limit: number;
}

export interface FindClientByIdOptions {
  allowInactive: boolean;
}

export class DuplicateEmailError extends Error {
  constructor(message = 'Email already exists') {
    super(message);
    this.name = 'DuplicateEmailError';
  }
}

export class ClientNotFoundError extends Error {
  constructor(message = 'Client not found') {
    super(message);
    this.name = 'ClientNotFoundError';
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAbsentPhone(phone: unknown): boolean {
  return phone === undefined || phone === null || phone === '';
}

export class ClientService {
  async create(input: CreateClientInput): Promise<IClient> {
    const email = normalizeEmail(input.email);
    const payload: {
      name: string;
      email: string;
      phone?: string;
      status: 'active';
    } = {
      name: input.name,
      email,
      status: 'active'
    };

    if (!isAbsentPhone(input.phone)) {
      payload.phone = input.phone as string;
    }

    try {
      return await Client.create(payload);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new DuplicateEmailError();
      }
      throw error;
    }
  }

  async list(input: ListClientsInput): Promise<ListClientsResult> {
    const filter = { status: input.status };
    const skip = (input.page - 1) * input.limit;

    const [items, total] = await Promise.all([
      Client.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(input.limit),
      Client.countDocuments(filter)
    ]);

    return {
      items,
      total,
      page: input.page,
      limit: input.limit
    };
  }

  async findById(id: string, options: FindClientByIdOptions): Promise<IClient> {
    const client = await Client.findById(id);
    if (!client) {
      throw new ClientNotFoundError();
    }

    if (client.status === 'inactive' && !options.allowInactive) {
      throw new ClientNotFoundError();
    }

    return client;
  }

  async deactivate(id: string): Promise<IClient> {
    const client = await Client.findById(id);
    if (!client) {
      throw new ClientNotFoundError();
    }

    if (client.status === 'inactive') {
      return client;
    }

    client.status = 'inactive';
    await client.save();
    return client;
  }
}

export default new ClientService();
