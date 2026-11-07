import type { Problem } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly traceId?: string
  readonly retryAfter?: number

  constructor(status: number, code: string, message: string, opts: { traceId?: string; retryAfter?: number } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.traceId = opts.traceId
    this.retryAfter = opts.retryAfter
  }

  static fromProblem(p: Partial<Problem>, status: number, retryAfter?: number): ApiError {
    return new ApiError(status, p.code ?? `HTTP_${status}`, p.detail || p.title || '', {
      traceId: p.traceId,
      retryAfter,
    })
  }
}

/** 網路斷線、逾時等拿不到 HTTP 回應的情況 */
export class NetworkError extends Error {
  constructor(message = '網路連線不穩定') {
    super(message)
    this.name = 'NetworkError'
  }
}

/** 給長輩看的白話錯誤訊息；後端的 detail 可能是技術字眼，不直接顯示 */
export function friendlyMessage(err: unknown): string {
  if (err instanceof NetworkError) return '網路好像斷了，請確認連線後再試一次。'
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return err.code === 'ARTWORK_IMAGE_INVALID' ? '圖片格式不對，請重新產生後再儲存。' : '資料有誤，請檢查後再試一次。'
      case 401:
        return '還沒登入，請到「我的」選擇示範帳號。'
      case 403:
        return '這張背景還沒解鎖，換一張背景試試看。'
      case 404:
        return '找不到這筆資料，可能已經下架了。'
      case 409:
        return '自己的作品不能按愛心喔。'
      case 413:
        return '圖片太大了（超過 10 MB），請換一張背景再試。'
      case 429:
        return `操作太頻繁，請等 ${err.retryAfter ?? 30} 秒再試。`
      case 503:
        return '系統忙碌中，請稍後再試。'
      default:
        return '系統出了點問題，請稍後再試。'
    }
  }
  return '發生未預期的錯誤，請稍後再試。'
}
