<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'

import { CloudPortalAPIError } from '@open-pencil/cloud/client'
import type { CloudAgentPairingRequest } from '@open-pencil/cloud/contract'
import { useMessages } from '@open-pencil/vue/i18n'

import { appHost } from '@/app/cloud-portal/apps'
import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { chooseLocalEditor } from '@/app/cloud-portal/site'
import { usePortalAction } from '@/app/cloud-portal/state'
import { newPairingToken, storedPairing } from '@/app/cloud/pairing/stored'
import PortalAgentPairing from '@/components/cloud-portal/auth/PortalAgentPairing.vue'
import PortalNotice from '@/components/cloud-portal/auth/PortalNotice.vue'

/**
 * Where an agent's sign-in goes for a person without an account: it pairs the agent with the editor
 * in this browser, which opens beside it, and returns to the agent.
 */
const portal = usePortal()
const appMessages = useMessages('cloud/portal/apps')
const failures = usePortalFailureMessages()
const query = globalThis.location.search.slice(1)
const request = shallowRef<CloudAgentPairingRequest | null>(null)
const expired = ref(false)
const lookupError = ref('')
const leaving = ref(false)

const refused = (error: unknown) => error instanceof CloudPortalAPIError && error.kind === 'domain'

onMounted(async () => {
  try {
    request.value = (await portal.api.agentPairingRequest(query)).request
  } catch (error) {
    if (refused(error)) expired.value = true
    else lookupError.value = failures.api(error)
  }
})

const {
  busy,
  error,
  run: decide
} = usePortalAction(async (decision: 'allow' | 'deny') => {
  const token = newPairingToken()
  // Opened by the click itself, before anything is waited for, or the browser blocks it.
  const editor = decision === 'allow' ? globalThis.open('', '_blank') : null
  try {
    const { redirect } = await portal.api.decideAgentPairing(
      decision === 'allow' ? { decision, query, token } : { decision, query }
    )
    leaving.value = true
    if (decision === 'allow') {
      chooseLocalEditor()
      storedPairing.value = { server: globalThis.location.origin, token }
      editor?.location.assign('/')
    }
    globalThis.location.assign(redirect)
  } catch (cause) {
    editor?.close()
    if (refused(cause)) expired.value = true
    else throw cause
  }
})
</script>

<template>
  <PortalNotice
    v-if="expired"
    :host="portal.host"
    :heading="appMessages.authorizeExpiredTitle"
    :description="appMessages.authorizeExpiredDescription"
  >
    <template #icon><icon-lucide-timer-off class="size-6" /></template>
  </PortalNotice>
  <PortalAgentPairing
    v-else-if="request"
    :host="portal.host"
    :app="{ name: request.app.name, host: appHost(request.app.uri) }"
    :returns-to="request.returnsTo"
    :deciding="busy || leaving"
    :error="error"
    @allow="decide('allow')"
    @deny="decide('deny')"
  />
  <PortalNotice
    v-else-if="lookupError"
    :host="portal.host"
    :heading="appMessages.authorizeExpiredTitle"
    :description="lookupError"
  >
    <template #icon><icon-lucide-cloud-off class="size-6" /></template>
  </PortalNotice>
</template>
