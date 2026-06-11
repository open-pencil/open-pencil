import { BOARD_API_ENDPOINTS } from '@/app/api/boards'

export type InvitationRole = 'editor' | 'viewer'
export type TeamMemberRole = 'owner' | 'editor' | 'viewer'

const ANONYMOUS_ID_STORAGE_KEY = 'inkly.anonymous-id'
export const ANONYMOUS_ID_HEADER = 'X-Inkly-Anonymous-Id'

export interface BoardCollaborator {
  anonymousId: string
  role: InvitationRole | 'owner'
  addedAt: number
  invitationId: string | null
}

export interface Board {
  id: string
  name: string
  creatorAnonymousId: string
  creatorUserId: string | null
  teamId: string | null
  createdAt: number
  updatedAt: number
  collaborators: BoardCollaborator[]
  team: BoardTeamSummary | null
}

export interface BoardTeamSummary {
  id: string
  name: string
}

export interface Invitation {
  id: string
  boardId: string
  sentToEmailHash: string
  role: InvitationRole
  createdAt: number
  expiresAt: number
  revoked: boolean
  jti: string
  token: string | null
}

export interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
  }
}

export interface InviteUserInput {
  email: string
  boardId: string
  role: InvitationRole
}

export interface InviteUserResponse {
  invitationId: string
  token: string
  expiresAt: number
  url: string
}

export interface VerifyInvitationResponse {
  valid: boolean
  invitation?: {
    id: string
    boardId: string
    role: InvitationRole
    expiresAt: number
  }
  reason?: string
}

export interface BoardInvitationsResponse {
  board: Board
  invitations: Invitation[]
}

function readAnonymousId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY)
}

function writeAnonymousId(anonymousId: string | null) {
  if (typeof window === 'undefined' || !anonymousId) return
  window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, anonymousId)
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers)
  const anonymousId = readAnonymousId()
  if (anonymousId) {
    headers.set(ANONYMOUS_ID_HEADER, anonymousId)
  }
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  return headers
}

export async function requestJson<T>(input: string, init: RequestInit = {}) {
  const response = await fetch(input, {
    ...init,
    // credentials: 'include' は better-auth の OAuth state cookie を確実に
    // 送受信するため必須。 default 'same-origin' でも同一 origin の Set-Cookie は
    // 保存されるはずだが、 一部ブラウザ + Secure cookie + SameSite=Lax の組合せで
    // fetch が credentials default だと cookie を一切扱わない挙動を確認。
    // 'include' で OAuth flow / session 維持 / CSRF 検証すべてが安定動作する。
    credentials: init.credentials ?? 'include',
    headers: buildHeaders(init)
  })

  writeAnonymousId(response.headers.get(ANONYMOUS_ID_HEADER))
  const data = (await response.json().catch(() => null)) as T | ApiErrorBody | null
  return { response, data }
}

export async function apiRequest<T>(input: string, init: RequestInit = {}): Promise<T> {
  const { response, data } = await requestJson<T>(input, init)

  if (!response.ok) {
    const errorBody = data as ApiErrorBody | null
    throw new Error(errorBody?.error?.message ?? `Request failed with status ${response.status}`)
  }

  return data as T
}

export function inviteUser(input: InviteUserInput) {
  return apiRequest<InviteUserResponse>(BOARD_API_ENDPOINTS.invite, {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function verifyInvitation(token: string) {
  return requestJson<VerifyInvitationResponse>(BOARD_API_ENDPOINTS.verifyInvite, {
    method: 'POST',
    body: JSON.stringify({ token })
  }).then(({ data }) => (data ?? { valid: false, reason: 'malformed' }) as VerifyInvitationResponse)
}

export function getAnonymousId() {
  return readAnonymousId()
}

export function setAnonymousId(anonymousId: string) {
  writeAnonymousId(anonymousId)
}

export function clearAnonymousId() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ANONYMOUS_ID_STORAGE_KEY)
}

export function createBoardEditorLocation(board: Board) {
  const query: Record<string, string> = {
    name: board.name
  }

  if (board.team?.name) {
    query.teamName = board.team.name
  }

  return {
    path: `/board/${board.id}`,
    query
  }
}

export async function listBoards() {
  const response = await apiRequest<{ boards: Board[] }>(BOARD_API_ENDPOINTS.boards)
  return response.boards
}

export function createBoard(input: { name: string; teamId?: string | null } | string) {
  const payload = typeof input === 'string' ? { name: input } : input
  return apiRequest<Board>(BOARD_API_ENDPOINTS.boards, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateBoard(boardId: string, input: { teamId?: string | null }) {
  return apiRequest<Board>(BOARD_API_ENDPOINTS.board(boardId), {
    method: 'PATCH',
    body: JSON.stringify(input)
  })
}

export function deleteBoard(boardId: string) {
  return apiRequest<{ deleted: boolean }>(BOARD_API_ENDPOINTS.board(boardId), {
    method: 'DELETE'
  })
}

export function listInvitations(boardId: string) {
  return apiRequest<BoardInvitationsResponse>(BOARD_API_ENDPOINTS.invitations(boardId))
}

export function revokeInvitation(boardId: string, invitationId: string) {
  return apiRequest<{ invitation: Invitation | null }>(
    BOARD_API_ENDPOINTS.invitation(boardId, invitationId),
    {
      method: 'DELETE'
    }
  )
}
