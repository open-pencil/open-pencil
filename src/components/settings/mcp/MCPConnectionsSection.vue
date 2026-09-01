<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'
import { computed, onMounted, ref, watch } from 'vue'

import {
  createMCPConnectionDraft,
  mcpConnectionCredentialStatus,
  mcpConnectionSettings,
  removeMCPConnection,
  saveMCPConnectionDraft,
  setMCPConnectionCredential,
  type MCPConnectionDraft
} from '@/app/integrations/mcp'
import type { CredentialStatus } from '@/app/settings/credentials/types'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'

const { automation, common, credentials } = useI18n()
const editing = ref(false)
const draft = ref<MCPConnectionDraft>(createMCPConnectionDraft())
const tokenDraft = ref('')
const tokenStatus = ref<CredentialStatus>('missing')
const error = ref('')
const deleteOpen = ref(false)

const savedConnection = computed(() =>
  draft.value.id
    ? mcpConnectionSettings.value.connections.find((connection) => connection.id === draft.value.id)
    : undefined
)

function startAdd(): void {
  draft.value = createMCPConnectionDraft()
  tokenDraft.value = ''
  tokenStatus.value = 'missing'
  error.value = ''
  editing.value = true
}

async function startEdit(id: string): Promise<void> {
  const connection = mcpConnectionSettings.value.connections.find((item) => item.id === id)
  if (!connection) return
  draft.value = createMCPConnectionDraft(connection)
  tokenDraft.value = ''
  tokenStatus.value = await mcpConnectionCredentialStatus(connection.id)
  error.value = ''
  editing.value = true
}

async function save(): Promise<void> {
  error.value = ''
  try {
    if (
      draft.value.enabled &&
      draft.value.authenticationType === 'bearer' &&
      !tokenDraft.value.trim() &&
      tokenStatus.value !== 'configured'
    ) {
      throw new Error(automation.value.bearerTokenRequired)
    }
    const connection = saveMCPConnectionDraft(draft.value)
    if (draft.value.authenticationType === 'none') {
      await setMCPConnectionCredential(connection.id, '')
    } else if (tokenDraft.value.trim()) {
      await setMCPConnectionCredential(connection.id, tokenDraft.value)
    }
    editing.value = false
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

async function clearCredential(): Promise<void> {
  if (!draft.value.id) return
  error.value = ''
  try {
    await setMCPConnectionCredential(draft.value.id, '')
    draft.value.enabled = false
    saveMCPConnectionDraft(draft.value)
    tokenDraft.value = ''
    tokenStatus.value = 'missing'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

async function remove(): Promise<void> {
  if (!draft.value.id) return
  error.value = ''
  try {
    await removeMCPConnection(draft.value.id)
    deleteOpen.value = false
    editing.value = false
  } catch (cause) {
    deleteOpen.value = false
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

watch(
  () => draft.value.authenticationType,
  (type) => {
    if (type === 'none') tokenDraft.value = ''
  }
)

onMounted(() => {
  tokenStatus.value = savedConnection.value ? 'configured' : 'missing'
})
</script>

<template>
  <section class="mt-5 border-t border-border pt-4" data-mcp-connections>
    <div v-if="editing" class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-xs font-semibold text-surface">
            {{ draft.id ? automation.editConnection : automation.addServerConnection }}
          </h3>
          <p class="text-[10px] text-muted">{{ automation.connectionEditorDescription }}</p>
        </div>
        <button
          type="button"
          class="text-[10px] text-muted hover:text-surface"
          @click="editing = false"
        >
          {{ common.back }}
        </button>
      </div>

      <label class="flex flex-col gap-1 text-[10px] text-muted">
        {{ automation.connectionName }}
        <AppInput
          v-model="draft.name"
          tone="panel"
          size="sm"
          :aria-label="automation.connectionName"
        />
      </label>
      <label class="flex flex-col gap-1 text-[10px] text-muted">
        {{ automation.serverURL }}
        <AppInput
          v-model="draft.url"
          tone="panel"
          size="sm"
          :aria-label="automation.serverURL"
          placeholder="https://example.com/mcp"
        />
      </label>
      <AppSwitch v-model="draft.enabled" :label="automation.enableConnection" />
      <AppSwitch
        :model-value="draft.authenticationType === 'bearer'"
        :label="automation.bearerAuthentication"
        @update:model-value="draft.authenticationType = $event ? 'bearer' : 'none'"
      />
      <ProviderSettingsKeyField
        v-if="draft.authenticationType === 'bearer'"
        v-model="tokenDraft"
        :label="automation.bearerToken"
        input-id="mcp-bearer-token"
        :saved="tokenStatus === 'configured'"
        kind="api"
        :placeholder="
          tokenStatus === 'configured'
            ? credentials.savedReplace
            : automation.bearerTokenPlaceholder
        "
        @clear="clearCredential"
      />

      <p v-if="error" class="text-[10px] text-danger" role="alert">{{ error }}</p>
      <div class="flex items-center justify-between">
        <button
          v-if="draft.id"
          type="button"
          class="text-[10px] text-danger hover:underline"
          @click="deleteOpen = true"
        >
          {{ automation.deleteConnection }}
        </button>
        <span v-else />
        <button
          type="button"
          class="rounded bg-accent px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90"
          @click="save"
        >
          {{ common.save }}
        </button>
      </div>
    </div>

    <div v-else>
      <div class="mb-2 flex items-center justify-between">
        <div>
          <h3 class="text-xs font-semibold text-surface">{{ automation.connections }}</h3>
          <p class="text-[10px] text-muted">{{ automation.connectionsDescription }}</p>
        </div>
        <button
          type="button"
          class="flex items-center gap-1 rounded bg-panel px-2 py-1 text-[10px] text-surface hover:bg-hover"
          @click="startAdd"
        >
          <icon-lucide-plus class="size-3" />
          {{ automation.addConnection }}
        </button>
      </div>
      <div v-if="mcpConnectionSettings.connections.length" class="flex flex-col gap-1.5">
        <button
          v-for="connection in mcpConnectionSettings.connections"
          :key="connection.id"
          type="button"
          class="flex items-center gap-2 rounded border border-border bg-panel-field px-3 py-2 text-left hover:bg-panel-field-hover"
          @click="startEdit(connection.id)"
        >
          <icon-lucide-plug class="size-3.5 text-muted" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-[11px] font-medium text-surface">{{ connection.name }}</p>
            <p class="truncate text-[10px] text-muted">{{ connection.transport.url }}</p>
          </div>
          <span class="text-[9px] text-muted">
            {{ connection.enabled ? common.enabled : common.disabled }}
          </span>
          <icon-lucide-chevron-right class="size-3.5 text-muted" />
        </button>
      </div>
      <p v-else class="rounded border border-dashed border-border p-3 text-[10px] text-muted">
        {{ automation.noConnections }}
      </p>
    </div>
  </section>

  <AppConfirmationDialog
    v-model:open="deleteOpen"
    :heading="automation.deleteConnection"
    :description="automation.deleteConnectionDescription"
    :cancel-label="common.cancel"
    :confirm-label="automation.deleteConnection"
    tone="danger"
    @confirm="remove"
  />
</template>
