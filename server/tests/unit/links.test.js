const links = require('../../src/services/links');

const id = '64d000000000000000000001';

describe('Signed links', () => {
  test('a link made by the server is accepted for its own purpose', () => {
    const token = links.sign('rate', id);
    expect(links.idFromToken(token)).toBe(id);
    expect(links.matches('rate', token)).toBe(true);
  });

  test('a rating link cannot be used as an invite link', () => {
    expect(links.matches('invite', links.sign('rate', id))).toBe(false);
  });

  test('changing the id inside a link breaks it', () => {
    const token = links.sign('rate', id);
    const forged = token.replace(id, '64d000000000000000000002');
    expect(links.matches('rate', forged)).toBe(false);
  });

  test('changing one character of the signature breaks it', () => {
    const token = links.sign('rate', id);
    const last = token.at(-1);
    expect(links.matches('rate', token.slice(0, -1) + (last === 'A' ? 'B' : 'A'))).toBe(false);
  });

  test('an invite link stops working when the nonce changes', () => {
    const token = links.sign('invite', id, 'nonce-1');
    expect(links.matches('invite', token, 'nonce-1')).toBe(true);
    expect(links.matches('invite', token, 'nonce-2')).toBe(false);
  });

  test.each([undefined, null, 42, '', 'abc', `${id}.short`, `${id}.${'x'.repeat(43)}.extra`])('rejects malformed token %p', (bad) => {
    expect(links.idFromToken(bad)).toBeNull();
    expect(links.matches('rate', bad)).toBe(false);
  });

  test('URLs point at the app', () => {
    expect(links.ratingUrl(id)).toMatch(/^http:\/\/app\.test\/rate\/64d0{20}1\./);
  });
});
