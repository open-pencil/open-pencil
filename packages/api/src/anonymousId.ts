import type { Context } from 'hono'

export const INKLY_ANONYMOUS_ID_HEADER = 'X-Inkly-Anonymous-Id'

export function resolveAnonymousId(c: Context): string {
  const existing = c.req.header(INKLY_ANONYMOUS_ID_HEADER)?.trim()
  const anonymousId = existing && existing.length > 0 ? existing : crypto.randomUUID()
  c.header(INKLY_ANONYMOUS_ID_HEADER, anonymousId)
  return anonymousId
}

// 招待者ラベル (in-app 通知の表示用)。 元は email/template.ts にあったが
// email 機能削除に伴い anonymousId utility 側に移動。
export function getInviterAnonymousLabel(anonymousId: string) {
  return anonymousId.slice(0, 8) || 'anonymous'
}
