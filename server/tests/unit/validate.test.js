const v = require('../../src/utils/validate');

describe('Input checks', () => {
  test.each([1, 5, '3'])('stars(%p) is accepted', (x) => expect(v.stars(x)).toBe(Number(x)));
  test.each([0, 6, 2.5, '', null, undefined, true, [4], { $gt: 0 }, 'four'])('stars(%p) is refused', (x) => {
    expect(() => v.stars(x)).toThrow('Choose 1 to 5 stars.');
  });

  test('id accepts only 24 hex characters', () => {
    expect(v.id('64d000000000000000000001')).toBe('64d000000000000000000001');
    for (const bad of [{ $ne: null }, 'abc', 123, '64d00000000000000000000z']) expect(() => v.id(bad)).toThrow();
  });

  test('text trims, enforces the limit and refuses objects', () => {
    expect(v.text('  hi  ', 'Name')).toBe('hi');
    expect(v.text('', 'Name')).toBeUndefined();
    expect(() => v.text('', 'Name', { required: true })).toThrow('Name is required.');
    expect(() => v.text('x'.repeat(11), 'Name', { max: 10 })).toThrow('too long');
    expect(() => v.text({ $gt: '' }, 'Name')).toThrow('must be text');
  });

  test('email is lower-cased and checked', () => {
    expect(v.email(' Mark@Client.COM ')).toBe('mark@client.com');
    expect(() => v.email('not-an-email')).toThrow('not a valid email');
  });

  test('password needs 8 characters', () => {
    expect(() => v.password('short')).toThrow();
    expect(v.password('long enough')).toBe('long enough');
  });
});
