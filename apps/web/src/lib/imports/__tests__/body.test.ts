import { describe, expect, it } from 'vitest';
import { boundedBody } from '../body';
describe('Import request streaming bounds', () => {
  it('reads an allowed body', async () => {
    const bytes = await boundedBody(new Request('http://localhost/api/imports', { method: 'POST', body: 'abc' }), 3);
    expect(new TextDecoder().decode(bytes)).toBe('abc');
  });
  it('rejects oversized chunked data without trusting Content-Length', async () => {
    const request = new Request('http://localhost/api/imports', { method: 'POST', body: 'abcdef' });
    expect(request.headers.has('content-length')).toBe(false);
    await expect(boundedBody(request, 3)).rejects.toThrow('too large');
  });
});
