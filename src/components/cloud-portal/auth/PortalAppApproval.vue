<script setup lang="ts">
import { computed } from 'vue'

import type { CloudAccessTokenAccess } from '@open-pencil/cloud/contract'
import { useMessages } from '@open-pencil/vue/i18n'

import { portalForm, portalPublic } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import PortalPublicLayout from '../layout/PortalPublicLayout.vue'

/**
 * Connecting an app, such as ChatGPT or Claude, that sent the person here through OAuth: what it
 * calls itself and where it says it comes from, what it may do, the one workspace it reaches, and a
 * warning that an app names itself. The app's own icon is never loaded: it is an address the app
 * chose, and fetching it would tell that address who opened the page.
 */
const {
  host,
  app,
  access,
  offline,
  email,
  workspaces,
  deciding = false,
  error = null
} = defineProps<{
  host: string
  app: {
    name: string
    /** The host of the address the app gave for itself, shown as text, or null. */
    host: string | null
  }
  access: CloudAccessTokenAccess
  /** Whether it stays connected until disconnected, rather than for an hour. */
  offline: boolean
  /** The signed-in account the app would act as. */
  email: string
  /** The workspaces the account may give the app. */
  workspaces: { id: string; name: string }[]
  deciding?: boolean
  /** Why the last answer didn't go through; the person can try again. */
  error?: string | null
}>()
/** The chosen workspace's ID, or an empty string before one is chosen. */
const workspace = defineModel<string>('workspace', { required: true })
const emit = defineEmits<{ allow: []; deny: [] }>()

const appMessages = useMessages('cloud/portal/apps')
const messages = useMessages('cloud/portal')
const ui = portalForm({ size: 'lg' })
const layout = portalPublic()

const options = computed(() =>
  workspaces.map((option) => ({ value: option.id, label: option.name }))
)
</script>

<template>
  <PortalPublicLayout
    :host="host"
    :heading="appMessages.authorizeTitle({ app: app.name })"
    :description="appMessages.authorizeDescription({ email })"
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
        <icon-lucide-pencil
          v-if="access === 'write'"
          class="mt-0.5 size-4 shrink-0 text-muted"
          aria-hidden="true"
        />
        <icon-lucide-eye v-else class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        <span>{{
          access === 'write' ? appMessages.authorizeWrite : appMessages.authorizeRead
        }}</span>
      </li>
      <li class="flex items-start gap-2.5">
        <icon-lucide-clock class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        <span>{{ offline ? appMessages.authorizeOffline : appMessages.authorizeOnline }}</span>
      </li>
    </ul>
    <AppFormField
      v-if="workspaces.length > 0"
      :label="appMessages.authorizeWorkspace"
      :hint="appMessages.authorizeWorkspaceHint"
      size="lg"
      :label-for="false"
    >
      <AppSelect
        v-model="workspace"
        :label="appMessages.authorizeWorkspace"
        :options="options"
        :placeholder="appMessages.authorizeWorkspacePlaceholder"
        size="lg"
        placement="below"
        :ui="{ trigger: 'w-full' }"
      />
    </AppFormField>
    <AppAlert
      v-else
      tone="warning"
      :heading="appMessages.authorizeNoWorkspaceTitle"
      :description="appMessages.authorizeNoWorkspaceDescription"
    />
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <AppAlert
      tone="warning"
      :heading="appMessages.authorizeWarningTitle"
      :description="appMessages.authorizeWarningDescription"
    />
    <div :class="ui.methods()">
      <AppButton
        size="lg"
        color="primary"
        variant="solid"
        :class="ui.submit()"
        :loading="deciding"
        :disabled="!workspace"
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
