<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCloudMessages } from '@open-pencil/vue'
import { useRoute, useRouter } from 'vue-router'

import { createInvitationWorkflow } from '@/app/cloud/documents/invitation-workflow'
import { openStorageDocumentInNewTab } from '@/app/tabs'
import AppButton from '@/components/ui/button/AppButton.vue'

const messages = useCloudMessages()
const route = useRoute()
const router = useRouter()
const token = window.location.hash.slice(1)
history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`)
const workflow = createInvitationWorkflow({
  serverURL: typeof route.query.server === 'string' ? route.query.server : '',
  invitationId: typeof route.params.invitationId === 'string' ? route.params.invitationId : '',
  continuation: typeof route.query.continuation === 'string' ? route.query.continuation : undefined,
  token,
  callbackURL: window.location.href,
  navigate: (url) => globalThis.location.assign(url),
  async open(target) {
    // Renderer preparation requires the workspace canvas to be mounted first.
    await router.replace('/')
    await openStorageDocumentInNewTab(target.document, target.binding)
  }
})
const { phase, failure, invitation } = workflow
const loading = computed(() => phase.value === 'loading')
const accepting = computed(() => phase.value === 'accepting' || phase.value === 'opening')
const error = computed(() => (failure.value ? messages.value[failure.value] : ''))
const summary = computed(() => {
  if (!invitation.value) return ''
  const values = {
    inviter: invitation.value.inviterName,
    recipient: invitation.value.recipientHint,
    document: invitation.value.documentName
  }
  return invitation.value.permission === 'edit'
    ? messages.value.invitationEditSummary(values)
    : messages.value.invitationViewSummary(values)
})
onMounted(workflow.load)
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-canvas p-6">
    <section class="w-full max-w-md rounded-lg border border-border bg-panel p-6 shadow-xl">
      <div
        class="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent"
      >
        <icon-lucide-mail class="size-5" />
      </div>
      <h1 class="text-lg font-semibold text-surface">{{ messages.documentInvitation }}</h1>
      <p v-if="loading" class="mt-3 text-sm text-muted">{{ messages.loadingInvitation }}</p>
      <template v-else-if="error">
        <p role="alert" class="mt-3 text-sm text-danger">{{ error }}</p>
        <AppButton class="mt-4" :disabled="accepting" @click="workflow.retry">{{
          messages.retry
        }}</AppButton>
      </template>
      <template v-else-if="invitation">
        <p class="mt-3 text-sm leading-relaxed text-muted">{{ summary }}</p>
        <p class="mt-2 text-xs text-muted">
          {{
            messages.invitationExpires({ date: new Date(invitation.expiresAt).toLocaleString() })
          }}
        </p>
        <AppButton
          color="neutral"
          variant="soft"
          size="sm"
          class="mt-5 w-full justify-center"
          :disabled="accepting"
          @click="workflow.accept"
        >
          {{ accepting ? messages.acceptingInvitation : messages.acceptInvitation }}
        </AppButton>
      </template>
    </section>
  </main>
</template>
