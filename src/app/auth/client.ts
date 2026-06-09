import {
  ANONYMOUS_ID_HEADER,
  apiRequest,
  clearAnonymousId,
  requestJson,
  type ApiErrorBody
} from '@/app/api/client'

const AUTH_API_BASE = '/api/auth'

export interface AuthSession {
  session: {
    id: string
    token: string
    userId: string
    expiresAt: string
    createdAt: string
    updatedAt: string
  }
  user: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: string
    updatedAt: string
  }
}

interface SocialSignInResponse {
  redirect: boolean
  url?: string
  token?: string
  user?: AuthSession['user']
}

export interface MigrateAnonymousResponse {
  migrated: boolean
  migratedBoardCount: number
  removedOwnerCollaboratorCount: number
}

function currentCallbackURL() {
  if (typeof window === 'undefined') return '/account'
  return window.location.toString()
}

function getErrorMessage(data: ApiErrorBody | null, fallback: string) {
  return data?.error?.message?.trim() || fallback
}

export async function getSession() {
  try {
    const { response, data } = await requestJson<AuthSession>(`${AUTH_API_BASE}/session`)

    // 401 (未ログイン) と server エラー (5xx 等) は同じく null 返却し、 上位で「未認証」扱いにする。
    // 5xx を throw すると refreshSession 経由で unhandled rejection → toast 誤表示になるため抑制する。
    if (!response.ok) {
      if (response.status !== 401) {
        console.warn('[auth.getSession]', response.status, getErrorMessage(data as ApiErrorBody | null, 'session load failed'))
      }
      return null
    }

    return data as AuthSession
  } catch (error) {
    // network error (fetch reject) も同様に null 扱い、 toast 誤表示を抑制
    console.warn('[auth.getSession]', error)
    return null
  }
}

export async function loginWithGoogle(callbackURL = currentCallbackURL()) {
  const { response, data } = await requestJson<SocialSignInResponse>(
    `${AUTH_API_BASE}/sign-in/social`,
    {
      method: 'POST',
      body: JSON.stringify({
        provider: 'google',
        callbackURL,
        disableRedirect: true
      })
    }
  )

  if (!response.ok) {
    const message = getErrorMessage(data as ApiErrorBody | null, 'Failed to start Google login')
    if (response.status === 404 || response.status === 400) {
      throw new Error('Google login is not configured in this environment')
    }
    throw new Error(message)
  }

  const redirectUrl = (data as SocialSignInResponse | null)?.url?.trim()
  if (!redirectUrl) {
    throw new Error('Google login is not configured in this environment')
  }

  if (typeof window !== 'undefined') {
    window.location.assign(redirectUrl)
  }
}

export function logout() {
  return apiRequest<{ success: boolean }>(`${AUTH_API_BASE}/sign-out`, {
    method: 'POST'
  }).then((result) => {
    clearAnonymousId()
    return result
  })
}

export function migrateAnonymous(anonymousId: string) {
  return apiRequest<MigrateAnonymousResponse>(`${AUTH_API_BASE}/migrate-anonymous`, {
    method: 'POST',
    headers: {
      [ANONYMOUS_ID_HEADER]: anonymousId
    }
  })
}
