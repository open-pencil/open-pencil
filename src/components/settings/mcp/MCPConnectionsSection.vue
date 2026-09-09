<script setup lang="ts">
import { ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { mcpConnectionSettings } from '@/app/integrations/mcp'
import { useMCPConnectionSettings } from '@/app/integrations/mcp/settings/use'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { automation, common, credentials } = useI18n()
const editing = ref(false)
const tokenDraft = ref('')
const deleteOpen = ref(false)

const connection = useMCPConnectionSettings(tokenDraft, automation)
const { draft, tokenStatus, error, clearCredential } = connection
function startAdd() {
  connection.startAdd()
  editing.value = true
}
async function startEdit(id: string) {
  if (await connection.startEdit(id)) editing.value = true
}
async function save() {
  if (await connection.save()) editing.value = false
}
async function remove() {
  if (await connection.remove()) editing.value = false
  deleteOpen.value = false
}
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
        <AppButton size="xs" @click="editing = false">
          {{ common.back }}
        </AppButton>
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
        <AppButton
          v-if="draft.id"
          size="xs"
          color="error"
          variant="link"
          @click="deleteOpen = true"
        >
          {{ automation.deleteConnection }}
        </AppButton>
        <span v-else />
        <AppButton color="primary" variant="solid" @click="save">
          {{ common.save }}
        </AppButton>
      </div>
    </div>

    <div v-else>
      <div class="mb-2 flex items-center justify-between">
        <div>
          <h3 class="text-xs font-semibold text-surface">{{ automation.connections }}</h3>
          <p class="text-[10px] text-muted">{{ automation.connectionsDescription }}</p>
        </div>
        <AppButton size="xs" variant="soft" @click="startAdd">
          <template #leading><icon-lucide-plus class="size-3" /></template>
          {{ automation.addConnection }}
        </AppButton>
      </div>
      <div v-if="mcpConnectionSettings.connections.length" class="flex flex-col gap-1.5">
        <AppActionRow
          v-for="connection in mcpConnectionSettings.connections"
          :key="connection.id"
          @click="startEdit(connection.id)"
        >
          <template #leading><icon-lucide-plug class="size-3.5" /></template>
          {{ connection.name }}
          <template #description>{{ connection.transport.url }}</template>
          <template #trailing>
            <span class="text-[9px]">{{
              connection.enabled ? common.enabled : common.disabled
            }}</span>
            <icon-lucide-chevron-right class="size-3.5" />
          </template>
        </AppActionRow>
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
