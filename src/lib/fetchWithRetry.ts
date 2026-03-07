/**
 * リトライ付きfetchユーティリティ
 * - ネットワークエラー（fetch例外）および500系サーバーエラーでリトライ
 * - 400系クライアントエラーはリトライしない
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { maxRetries?: number; baseDelay?: number }
): Promise<Response> {
  const maxRetries = options?.maxRetries ?? 2
  const baseDelay = options?.baseDelay ?? 500

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(input, init)

      // 400系はリトライしない（クライアントエラー）
      // 500系はリトライ対象
      if (res.status >= 500 && attempt < maxRetries) {
        await delay(baseDelay * Math.pow(2, attempt))
        continue
      }

      return res
    } catch (err) {
      lastError = err

      if (attempt < maxRetries) {
        await delay(baseDelay * Math.pow(2, attempt))
        continue
      }
    }
  }

  throw lastError
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
