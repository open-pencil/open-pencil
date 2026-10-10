<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { continuationPath } from '@/app/cloud-portal/navigation'
import PortalTwoFactor from '@/components/cloud-portal/auth/PortalTwoFactor.vue'

const portal = usePortal()
const route = useRoute()
const router = useRouter()
const { failure } = usePortalFailureMessages()
const method = ref<'authenticator' | 'recovery'>('authenticator')
const error = ref<string | null>(null)
const verifying = ref(false)
const redirect = computed(() => continuationPath(route.query.redirect))
const passkeys = computed(() => portal.discovery.authentication.mfa?.passkeys ?? false)

async function finish(result: Awaited<ReturnType<typeof portal.auth.verifyTwoStep>>) {
  if (!result.ok) {
    error.value = failure(result.failure)
    return
  }
  await portal.refreshAccount()
  await router.replace(redirect.value)
}

async function verify(code: string) {
  verifying.value = true
  error.value = null
  try {
    await finish(await portal.auth.verifyTwoStep(method.value, code.trim()))
  } finally {
    verifying.value = false
  }
}

async function passkey() {
  error.value = null
  await finish(await portal.auth.withPasskey())
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
