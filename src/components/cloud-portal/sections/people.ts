import type { CloudPortalClient } from '@open-pencil/cloud/client'
import type { CloudAdminUser } from '@open-pencil/cloud/contract'

import type { useDateFormat } from '@/app/i18n/date'

import type { PortalPerson, PortalPersonAction } from '../types'

type Dates = ReturnType<typeof useDateFormat>

/** An account as the console shows it; `you` marks the administrator's own. */
export function portalPerson(
  user: CloudAdminUser,
  you: string | undefined,
  dates: Dates
): PortalPerson {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    admin: user.role === 'admin',
    suspended: user.banned === true,
    suspendedReason: user.banned ? (user.banReason ?? null) : null,
    twoStep: user.twoStep,
    joinedOn: dates.format(user.createdAt, 'date'),
    lastActive: user.lastActiveAt ? dates.relative(user.lastActiveAt) : null,
    workspaceCount: user.workspaceCount,
    you: user.id === you
  }
}

/** Asks the server to do what an administrator confirmed. */
export function personAction(
  api: CloudPortalClient,
  person: PortalPerson,
  action: PortalPersonAction,
  reason?: string
): Promise<unknown> {
  const requests: Record<PortalPersonAction, () => Promise<unknown>> = {
    'make-admin': () => api.setAdmin(person.id, true),
    'remove-admin': () => api.setAdmin(person.id, false),
    'sign-out': () => api.userAction('revoke-sessions', person.id),
    'reset-two-step': () => api.userAction('reset-two-step', person.id),
    'remove-picture': () => api.userAction('remove-picture', person.id),
    suspend: () => api.userAction('ban', person.id, reason),
    restore: () => api.userAction('unban', person.id)
  }
  return requests[action]()
}
