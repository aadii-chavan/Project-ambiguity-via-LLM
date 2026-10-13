import { api, ApiError, exportUrl } from './client'

const reply = (status: number, body?: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status })))

afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  it('returns parsed JSON on success and posts the body', async () => {
    reply(200, { id: 's1' })
    const r = await api.analyze('text', { strictness: 'balanced', style: 'shall', glossary: [] })
    expect(r).toEqual({ id: 's1' })
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/analyze')
    expect(JSON.parse(init.body)).toMatchObject({ text: 'text', options: { strictness: 'balanced' } })
  })
  it('uses FastAPI detail strings', async () => {
    reply(422, { detail: 'No requirements found in the input' })
    await expect(api.listSessions()).rejects.toMatchObject({ message: 'No requirements found in the input', status: 422 })
  })
  it('joins validation error arrays', async () => {
    reply(422, { detail: [{ msg: 'a' }, { msg: 'b' }] })
    await expect(api.getSession('x')).rejects.toThrow('a; b')
  })
  it('uses the contract error shape', async () => {
    reply(500, { error: { code: 'internal_error', message: 'Unexpected server error' } })
    await expect(api.getSession('x')).rejects.toThrow('Unexpected server error')
  })
  it('falls back to a generic message for non-JSON errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 })))
    await expect(api.listSessions()).rejects.toThrow('Request failed (502)')
  })
  it('explains when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const e = await api.listSessions().catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.message).toMatch(/backend running/)
  })
  it('handles 204 and builds export URLs', async () => {
    reply(204)
    await expect(api.deleteSession('s1')).resolves.toBeUndefined()
    expect(exportUrl('s1', 'docx')).toBe('/api/sessions/s1/export?format=docx')
  })
})
