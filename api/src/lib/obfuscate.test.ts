import { obfuscateValue, toPublicClient } from './obfuscate';

describe('obfuscateValue', () => {
  it('masks strings of length >= 3 keeping first and last character', () => {
    expect(obfuscateValue('abcdef')).toBe('a****f');
    expect(obfuscateValue('ab@cd.com')).toBe('a*******m');
  });

  it('masks strings of length 1-2 entirely with *', () => {
    expect(obfuscateValue('a')).toBe('*');
    expect(obfuscateValue('ab')).toBe('**');
  });

  it('returns empty string unchanged', () => {
    expect(obfuscateValue('')).toBe('');
  });

  it('returns non-strings unchanged', () => {
    expect(obfuscateValue(42)).toBe(42);
    expect(obfuscateValue(true)).toBe(true);
    expect(obfuscateValue({ a: 1 })).toEqual({ a: 1 });
    expect(obfuscateValue([1, 2])).toEqual([1, 2]);
  });

  it('returns null and undefined unchanged', () => {
    expect(obfuscateValue(null)).toBeNull();
    expect(obfuscateValue(undefined)).toBeUndefined();
  });

  it('masks by Unicode code points (emoji / CJK)', () => {
    expect(obfuscateValue('あいう')).toBe('あ*う');
    expect(obfuscateValue('😀🎉😎')).toBe('😀*😎');
  });
});

describe('toPublicClient', () => {
  const buildDoc = (overrides: Record<string, unknown> = {}) => {
    const base = {
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      name: 'Acme Corp',
      email: 'admin@acme.com',
      phone: '+14155552671',
      status: 'active',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      __v: 0,
      secretInternal: 'hidden',
      ...overrides
    };
    return {
      toObject: () => ({ ...base })
    };
  };

  it('returns whitelisted fields with obfuscated PII', () => {
    const result = toPublicClient(buildDoc() as never);
    expect(result).toEqual({
      id: '507f1f77bcf86cd799439011',
      name: 'Acme Corp',
      email: obfuscateValue('admin@acme.com'),
      phone: obfuscateValue('+14155552671'),
      status: 'active',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z')
    });
    expect(result).not.toHaveProperty('__v');
    expect(result).not.toHaveProperty('secretInternal');
    expect(result).not.toHaveProperty('_id');
  });

  it('omits phone when absent', () => {
    const doc = buildDoc();
    const plain = doc.toObject();
    delete plain.phone;
    const result = toPublicClient({ toObject: () => plain } as never);
    expect(result).not.toHaveProperty('phone');
  });
});
