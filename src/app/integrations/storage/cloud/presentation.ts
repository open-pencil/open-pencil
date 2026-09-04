import type { CloudConnectionStatus } from './connection'

export type CloudConnectionPrimaryAction =
  | 'open-workspace'
  | 'reauthenticate'
  | 'reconnect'
  | 'retry'
  | 'sign-in'

export type CloudConnectionPresentation = {
  status: CloudConnectionStatus
  primaryAction: CloudConnectionPrimaryAction
  tone: 'accent' | 'danger' | 'muted'
}

export function cloudConnectionPresentation(
  status: CloudConnectionStatus
): CloudConnectionPresentation {
  switch (status) {
    case 'connected':
      return { status, primaryAction: 'open-workspace', tone: 'accent' }
    case 'unauthenticated':
      return { status, primaryAction: 'sign-in', tone: 'muted' }
    case 'authentication-required':
      return { status, primaryAction: 'reauthenticate', tone: 'danger' }
    case 'discovering':
      return { status, primaryAction: 'retry', tone: 'muted' }
    case 'offline':
      return { status, primaryAction: 'retry', tone: 'danger' }
    case 'error':
      return { status, primaryAction: 'retry', tone: 'danger' }
    case 'disconnected':
      return { status, primaryAction: 'reconnect', tone: 'muted' }
  }
  throw new Error('Unknown Cloud connection status')
}
