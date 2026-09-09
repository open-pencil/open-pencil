import { ref } from 'vue'

/** Invalidate the native access-state query after credential operations settle. */
export const nativeCredentialAccessRevision = ref(0)

export function invalidateNativeCredentialAccess(): void {
  nativeCredentialAccessRevision.value++
}
