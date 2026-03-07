import { fetchWithRetry } from '../lib/fetchWithRetry'

// グローバルfetchをモック
const mockFetch = jest.fn()
global.fetch = mockFetch

const ok200 = () => Promise.resolve({ status: 200, ok: true } as Response)
const error500 = () => Promise.resolve({ status: 500, ok: false } as Response)
const error400 = () => Promise.resolve({ status: 400, ok: false } as Response)
const networkError = () => Promise.reject(new TypeError('Failed to fetch'))

describe('fetchWithRetry', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('成功時はそのままレスポンスを返す', async () => {
    mockFetch.mockImplementation(ok200)

    const res = await fetchWithRetry('/api/test', undefined, { baseDelay: 1 })

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('500エラー後にリトライして成功する', async () => {
    mockFetch
      .mockImplementationOnce(error500)
      .mockImplementationOnce(ok200)

    const res = await fetchWithRetry('/api/test', undefined, { baseDelay: 1 })

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('ネットワークエラー後にリトライして成功する', async () => {
    mockFetch
      .mockImplementationOnce(networkError)
      .mockImplementationOnce(ok200)

    const res = await fetchWithRetry('/api/test', undefined, { baseDelay: 1 })

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('400エラーはリトライしない', async () => {
    mockFetch.mockImplementation(error400)

    const res = await fetchWithRetry('/api/test', undefined, { baseDelay: 1 })

    expect(res.status).toBe(400)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('最大リトライ回数を超えると500レスポンスをそのまま返す', async () => {
    mockFetch.mockImplementation(error500)

    const res = await fetchWithRetry('/api/test', undefined, { maxRetries: 2, baseDelay: 1 })

    expect(res.status).toBe(500)
    expect(mockFetch).toHaveBeenCalledTimes(3) // 初回 + リトライ2回
  })

  it('最大リトライ回数を超えたネットワークエラーはthrowする', async () => {
    mockFetch.mockImplementation(networkError)

    await expect(
      fetchWithRetry('/api/test', undefined, { maxRetries: 2, baseDelay: 1 })
    ).rejects.toThrow('Failed to fetch')

    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('maxRetries=0ではリトライしない', async () => {
    mockFetch.mockImplementation(error500)

    const res = await fetchWithRetry('/api/test', undefined, { maxRetries: 0, baseDelay: 1 })

    expect(res.status).toBe(500)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('initオプションがfetchにそのまま渡される', async () => {
    mockFetch.mockImplementation(ok200)

    await fetchWithRetry('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"key":"value"}'
    }, { baseDelay: 1 })

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"key":"value"}'
    })
  })
})
