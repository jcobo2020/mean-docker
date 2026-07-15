/**
 * Obfuscates PII values for API responses.
 * Masks by Unicode code points (Array.from), not bytes.
 */
export function obfuscateValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  if (value === '') {
    return '';
  }

  const characters = Array.from(value);
  if (characters.length <= 2) {
    return '*'.repeat(characters.length);
  }

  const middle = '*'.repeat(characters.length - 2);
  return `${characters[0]}${middle}${characters[characters.length - 1]}`;
}

export interface PublicClient {
  id: string;
  name: string;
  email: unknown;
  phone?: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Builds the public client shape by explicit whitelist.
 * Applies obfuscateValue only to PII fields (email, phone).
 */
export function toPublicClient(doc: {
  toObject: (options?: { virtuals?: boolean }) => Record<string, unknown> & {
    _id: { toString(): string };
    name: string;
    email: string;
    phone?: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
}): PublicClient {
  const plain = doc.toObject({ virtuals: false });
  const publicClient: PublicClient = {
    id: plain._id.toString(),
    name: plain.name,
    email: obfuscateValue(plain.email),
    status: plain.status,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };

  if (plain.phone !== undefined && plain.phone !== null && plain.phone !== '') {
    publicClient.phone = obfuscateValue(plain.phone);
  }

  return publicClient;
}
