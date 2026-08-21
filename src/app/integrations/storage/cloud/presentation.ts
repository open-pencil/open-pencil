import type { CloudConnectionStatus } from './connection'

export type CloudConnectionPrimaryAction =
  | 'open-workspace'
  | 'reauthenticate'
  | 'reconnect'
  | 'retry'
  | 'sign-in'

export type CloudConnectionPresentation = {
  label: string
  description: string | null
  primaryAction: CloudConnectionPrimaryAction
  tone: 'accent' | 'danger' | 'muted'
}

export function cloudConnectionPresentation(
  status: CloudConnectionStatus
): CloudConnectionPresentation {
  switch (status) {
    case 'connected':
      return {
        label: 'Connected',
        description: null,
        primaryAction: 'open-workspace',
        tone: 'accent'
      }
    case 'unauthenticated':
      return {
        label: 'Sign in required',
        description: 'Sign in to access this instance and its workspaces.',
        primaryAction: 'sign-in',
        tone: 'muted'
      }
    case 'authentication-required':
      return {
        label: 'Reauthentication required',
        description: 'Your saved session is no longer accepted.',
        primaryAction: 'reauthenticate',
        tone: 'danger'
      }
    case 'discovering':
      return { label: 'Connecting…', description: null, primaryAction: 'retry', tone: 'muted' }
    case 'offline':
      return {
        label: 'Offline',
        description: 'This instance cannot currently be reached.',
        primaryAction: 'retry',
        tone: 'danger'
      }
    case 'error':
      return {
        label: 'Connection error',
        description: 'OpenPencil could not connect to this instance.',
        primaryAction: 'retry',
        tone: 'danger'
      }
    case 'disconnected':
      return {
        label: 'Disconnected',
        description: 'Synchronization is paused until this instance is reconnected.',
        primaryAction: 'reconnect',
        tone: 'muted'
      }
  }
  throw new Error('Unknown Cloud connection status')
}
