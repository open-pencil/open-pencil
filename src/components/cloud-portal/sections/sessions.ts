import type { CloudAccountSession, CloudSignIn } from '@open-pencil/cloud/contract'

import type { useDateFormat } from '@/app/i18n/date'

import type { PortalSession, PortalSignIn } from '../types'

type Dates = ReturnType<typeof useDateFormat>

/** A session as the portal lists it, with its dates in words. */
export function portalSession(session: CloudAccountSession, dates: Dates): PortalSession {
  return {
    id: session.id,
    current: session.current,
    method: session.method,
    browser: session.browser,
    system: session.system,
    ipAddress: session.ipAddress,
    lastActive: dates.relative(session.lastActiveAt),
    signedInOn: dates.format(session.createdAt, 'date')
  }
}

export function portalSignIn(signIn: CloudSignIn, dates: Dates): PortalSignIn {
  return {
    id: signIn.id,
    method: signIn.method,
    browser: signIn.browser,
    system: signIn.system,
    ipAddress: signIn.ipAddress,
    when: dates.format(signIn.createdAt, 'dateTime')
  }
}
