<script setup lang="ts">
import { useMessages } from '@open-pencil/vue/i18n'

import { portalForm, portalPublic } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalPublicLayout from '../layout/PortalPublicLayout.vue'

/**
 * Pairing an agent with this browser's editor without an account: what it calls itself, where the
 * browser returns to, what it may do, and a warning that an app names itself.
 */
const {
  host,
  app,
  returnsTo,
  deciding = false,
  error = null
} = defineProps<{
  host: string
  app: { name: string; host: string | null }
  /** The host the browser goes back to with the answer. */
  returnsTo: string
  deciding?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ allow: []; deny: [] }>()

const appMessages = useMessages('cloud/portal/apps')
const messages = useMessages('cloud/portal')
const ui = portalForm({ size: 'lg' })
const layout = portalPublic()
</script>

<template>
  <PortalPublicLayout
    :host="host"
    :heading="appMessages.authorizeTitle({ app: app.name })"
    :description="appMessages.pairDescription"
  >
    <template #icon>
      <span :class="layout.tile()" aria-hidden="true"><icon-lucide-plug class="size-6" /></span>
    </template>
    <ul class="flex flex-col gap-2 rounded-lg bg-panel-field px-4 py-3 text-sm">
      <li v-if="app.host" class="flex items-start gap-2.5">
        <icon-lucide-globe class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        <span class="min-w-0 break-words">{{
          appMessages.authorizeAddress({ host: app.host })
        }}</span>
      </li>
      <li class="flex items-start gap-2.5">
        <icon-lucide-pencil class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        <span>{{ appMessages.pairAccess }}</span>
      </li>
      <li class="flex items-start gap-2.5">
        <icon-lucide-clock class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        <span>{{ appMessages.authorizeOffline }}</span>
      </li>
      <li class="flex items-start gap-2.5">
        <icon-lucide-corner-down-left
          class="mt-0.5 size-4 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span class="min-w-0 break-words">{{ appMessages.pairReturns({ host: returnsTo }) }}</span>
      </li>
    </ul>
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <AppAlert
      tone="warning"
      :heading="appMessages.authorizeWarningTitle"
      :description="appMessages.pairWarning"
    />
    <div :class="ui.methods()">
      <AppButton
        size="lg"
        color="primary"
        variant="solid"
        :class="ui.submit()"
        :loading="deciding"
        data-test-id="pair-agent-allow"
        @click="emit('allow')"
      >
        {{ appMessages.allow }}
      </AppButton>
      <AppButton
        size="lg"
        variant="outline"
        :class="ui.submit()"
        :disabled="deciding"
        @click="emit('deny')"
      >
        {{ messages.deny }}
      </AppButton>
    </div>
  </PortalPublicLayout>
</template>
