<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { continuationPath } from '@/app/cloud-portal/navigation'
import { usePortalAction } from '@/app/cloud-portal/state'
import PortalTwoFactor from '@/components/cloud-portal/auth/PortalTwoFactor.vue'

const portal = usePortal()
const route = useRoute()
const router = useRouter()
const { failure } = usePortalFailureMessages()
const method = ref<'authenticator' | 'recovery'>('authenticator')
const redirect = computed(() => continuationPath(route.query.redirect))
const passkeys = computed(() => portal.discovery.authentication.mfa?.passkeys ?? false)

type TwoStepResult = Awaited<ReturnType<typeof portal.auth.verifyTwoStep>>

/** One attempt at the second step: a refused code stays on the page, a passed one continues. */
const {
  busy: verifying,
  error,
  run,
  fail
} = usePortalAction(async (attempt: () => Promise<TwoStepResult>) => {
  const result = await attempt()
  if (!result.ok) {
    fail(failure(result.failure))
    return
  }
  await portal.refreshAccount()
  await router.replace(redirect.value)
})

function verify(code: string) {
  void run(() => portal.auth.verifyTwoStep(method.value, code.trim()))
}

function passkey() {
  if (!verifying.value) void run(() => portal.auth.withPasskey())
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
