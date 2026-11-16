<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { continuationPath } from '@/app/cloud-portal/navigation'
import { usePortalAction } from '@/app/cloud-portal/state'
import PortalTwoFactor from '@/components/cloud-portal/auth/PortalTwoFactor.vue'

/**
 * Proves the second step for the session already signed in, as one made through Google must
 * before it may use the server, and an administrator's must again after a while. Unlike the
 * two-step page of a password sign-in, the session exists, so it proves the step itself.
 */
const portal = usePortal()
const route = useRoute()
const router = useRouter()
const { failure, api } = usePortalFailureMessages()
const method = ref<'authenticator' | 'recovery'>('authenticator')
const redirect = computed(() => continuationPath(route.query.redirect))
const passkeys = computed(() => portal.discovery.authentication.mfa?.passkeys ?? false)

const {
  busy: verifying,
  error,
  run,
  fail
} = usePortalAction(async (attempt: () => Promise<string | null>) => {
  const refused = await attempt()
  if (refused) {
    fail(refused)
    return
  }
  await portal.refreshAccount()
  await router.replace(redirect.value)
})

/** A refused code's words, or null once the session proved it. */
async function proved(check: () => Promise<unknown>): Promise<string | null> {
  try {
    await check()
    return null
  } catch (error) {
    return api(error)
  }
}

function verify(code: string) {
  void run(() =>
    proved(() =>
      method.value === 'authenticator'
        ? portal.api.verifyTOTP(code)
        : portal.api.verifyRecoveryCode(code)
    )
  )
}

// A session that proved its step lately, as a password sign-in with its code just did, has
// nothing to prove here and goes on; one held, or an administrator's aged one, proves it.
let left = false
onBeforeUnmount(() => {
  left = true
})
onMounted(async () => {
  if (portal.account.value?.state === 'two-step') return
  // The page and where it leads, as they were when asked: an answer after the person left
  // decides nothing.
  const page = route.fullPath
  const destination = redirect.value
  const mfa = (await portal.api.mfaStatus().catch(() => null))?.mfa
  if (mfa?.assured && !left && route.fullPath === page) await router.replace(destination)
})

// A passkey signs in anew, in a session that proved it.
function passkey() {
  if (verifying.value) return
  void run(async () => {
    const result = await portal.auth.withPasskey()
    return result.ok ? null : failure(result.failure)
  })
}
</script>

<template>
  <PortalTwoFactor
    :host="portal.host"
    :method="method"
    :passkeys="passkeys"
    :error="error"
    :verifying="verifying"
    @verify="verify"
    @switch-method="method = method === 'authenticator' ? 'recovery' : 'authenticator'"
    @passkey="passkey"
  />
</template>
