export const BOARD_API_ENDPOINTS = {
  boards: '/api/boards',
  board: (boardId: string) => `/api/boards/${boardId}`,
  invitations: (boardId: string) => `/api/boards/${boardId}/invitations`,
  invitation: (boardId: string, invitationId: string) =>
    `/api/boards/${boardId}/invitations/${invitationId}`,
  invite: '/api/invite',
  verifyInvite: '/api/invite/verify',
  redeemInvite: '/api/invite/redeem'
} as const
