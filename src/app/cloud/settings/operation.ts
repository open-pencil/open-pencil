import { CloudAPIError, CloudDeviceAuthorizationError } from '@open-pencil/cloud/client'

export type CloudOperationFailure = 'authentication-required' | 'unavailable'
export type CloudOperationResult = { ok: true } | { ok: false; failure: CloudOperationFailure }

/** Keep transport errors out of UI state; components own localized presentation. */
export async function runCloudOperation(
  operation: () => Promise<unknown>
): Promise<CloudOperationResult> {
  try {
    await operation()
    return { ok: true }
  } catch (error) {
    const authenticationRequired =
      (error instanceof CloudAPIError && error.status === 401) ||
      (error instanceof CloudDeviceAuthorizationError && error.code === 'expired')
    return {
      ok: false,
      failure: authenticationRequired ? 'authentication-required' : 'unavailable'
    }
  }
}

export function cloudOperationMessage(failure: CloudOperationFailure) {
  return failure === 'authentication-required'
    ? 'statusReauthenticationRequiredDescription'
    : 'statusConnectionErrorDescription'
}
