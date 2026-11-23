<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'

import { CloudPortalAPIError } from '@open-pencil/cloud/client'
import type { CloudOAuthDecision, CloudOAuthRequest } from '@open-pencil/cloud/contract'
import { useMessages } from '@open-pencil/vue/i18n'

import { appHost, scopeAccess } from '@/app/cloud-portal/apps'
import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { usePortalAction } from '@/app/cloud-portal/state'
import PortalAppApproval from '@/components/cloud-portal/auth/PortalAppApproval.vue'
import PortalNotice from '@/components/cloud-portal/auth/PortalNotice.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

/**
 * Where an app's OAuth sign-in sends the person: the server signed the query it sent, so the page
 * passes it back as it arrived and shows the request it stands for. Signing in on the way keeps
 * the query's values, which is all the signature covers.
 */
const portal = usePortal()
const messages = useMessages('cloud/portal')
const appMessages = useMessages('cloud/portal/apps')
const failures = usePortalFailureMessages()
const query = globalThis.location.search.slice(1)
const state = ref<'checking' | 'pending' | 'expired' | 'failed'>('checking')
const request = shallowRef<CloudOAuthRequest | null>(null)
const workspace = ref('')
const lookupError = ref('')
/** Set once the server answered, while the browser goes back to the app. */
const leaving = ref(false)

/** The server refused the request itself, as when it expired or was changed; nothing else is. */
const refused = (error: unknown) => error instanceof CloudPortalAPIError && error.kind === 'domain'

/** The request the query stands for, or null when the server refused it. */
async function read(): Promise<CloudOAuthRequest | null> {
  try {
    return (await portal.api.oauthRequest(query)).request
  } catch (error) {
    if (refused(error)) return null
    throw error
  }
}

function show(value: CloudOAuthRequest) {
  request.value = value
  // One workspace is the choice already; a chosen one stays chosen while the account is in it.
  const [only, ...others] = value.workspaces
  if (!value.workspaces.some((option) => option.id === workspace.value)) {
    workspace.value = only && others.length === 0 ? only.id : ''
  }
  state.value = 'pending'
}

async function look() {
  if (!query) {
    state.value = 'expired'
    return
  }
  state.value = 'checking'
  try {
    const value = await read()
    if (value) show(value)
    else state.value = 'expired'
  } catch (error) {
    // A busy or unreachable server leaves the request to look at again.
    lookupError.value = failures.api(error)
    state.value = 'failed'
  }
}

onMounted(look)

const {
  busy: deciding,
  error,
  run: decide,
  fail
} = usePortalAction(async (decision: 'allow' | 'deny') => {
  const answer: CloudOAuthDecision =
    decision === 'allow' ? { decision, query, workspaceId: workspace.value } : { decision, query }
  try {
    const { redirect } = await portal.api.decideOAuth(answer)
    leaving.value = true
    globalThis.location.assign(redirect)
  } catch (cause) {
    if (!refused(cause)) throw cause
    // The server refuses an answer for an expired request or a workspace the account left; the
    // request, read again, tells which, and brings the workspaces up to date.
    const value = await read()
    if (!value) {
      state.value = 'expired'
      return
    }
    show(value)
    fail(decision === 'allow' ? appMessages.value.authorizeWorkspaceGone : failures.api(cause))
  }
})

const app = computed(() =>
  request.value
    ? { name: request.value.app.name, host: appHost(request.value.app.uri) }
    : { name: '', host: null }
)
</script>

<template>
  <PortalAppApproval
    v-if="state === 'pending' && request && portal.account.value"
    v-model:workspace="workspace"
    :host="portal.host"
    :app="app"
    :access="scopeAccess(request.scopes)"
    :offline="request.offline"
    :email="portal.account.value.user.email"
    :workspaces="request.workspaces"
    :deciding="deciding || leaving"
    :error="error"
    @allow="decide('allow')"
    @deny="decide('deny')"
  />
  <PortalNotice
    v-else-if="state === 'failed'"
    :host="portal.host"
    :heading="messages.errorTitle"
    :description="lookupError"
  >
    <template #icon><icon-lucide-cloud-off class="size-6" /></template>
    <template #actions>
      <AppButton size="lg" variant="outline" class="w-full" @click="look">
        {{ messages.tryAgain }}
      </AppButton>
    </template>
  </PortalNotice>
  <PortalNotice
    v-else-if="state === 'expired'"
    :host="portal.host"
    :heading="appMessages.authorizeExpiredTitle"
    :description="appMessages.authorizeExpiredDescription"
  >
    <template #icon><icon-lucide-timer-off class="size-6" /></template>
  </PortalNotice>
</template>
