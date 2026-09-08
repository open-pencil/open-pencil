import type { CloudDeviceAuthState } from '../sessions/device-authorization'

/** Presentation keys only; callers resolve against the current locale at render time. */
export function deviceAuthorizationMessage(state: CloudDeviceAuthState) {
  switch (state.status) {
    case 'denied':
      return 'authorizationDenied'
    case 'expired':
      return 'authorizationExpired'
    case 'error':
      return state.code
    default:
      return null
  }
}
