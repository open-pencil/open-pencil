import { ref } from 'vue'

/** Status retries only inspect access; resetting the denial latch is a separate action. */
export function createCredentialAccessCheck(query: () => Promise<boolean>) {
  const paused = ref(false)
  const checkFailed = ref(false)
  let revision = 0
  async function check() {
    const current = ++revision
    try {
      const value = await query()
      if (current !== revision) return
      paused.value = value
      checkFailed.value = false
    } catch {
      if (current !== revision) return
      paused.value = false
      checkFailed.value = true
    }
  }
  function invalidate() {
    revision++
  }
  return { paused, checkFailed, check, invalidate }
}
