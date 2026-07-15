import Client, { IClient } from '../models/client';

export interface CreateClientInput {
  name: string;
  email: string;
  phone?: string;
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
