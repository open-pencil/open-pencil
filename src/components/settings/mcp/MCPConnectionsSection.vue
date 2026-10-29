<script setup lang="ts">
import { AlertDialogAction, AlertDialogCancel } from 'reka-ui'
import { computed, ref, useTemplateRef, watch } from 'vue'

import {
  useAutomationMessages,
  useCommonMessages,
  useSettingsMessages
} from '@open-pencil/vue/i18n'

import { mcpConnectionSettings } from '@/app/integrations/mcp'
import { useMCPConnectionForm } from '@/app/integrations/mcp/settings/form'
import { useMCPConnectionSettings } from '@/app/integrations/mcp/settings/use'
import { useSettingsFormGuard } from '@/app/settings/navigation/use'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { AppAlertDialogRoot, AppDialogFooter, AppDialogHeader } from '@/components/ui/dialog'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'
import PanelDrillIn from '@/components/ui/panel/PanelDrillIn.vue'
import { MCP_CONNECTIONS_DOCS_URL } from '@/constants'

import MCPConnectionEditor from './MCPConnectionEditor.vue'

const automation = useAutomationMessages()
const common = useCommonMessages()
const editing = ref(false)
const tokenDraft = ref('')
const deleteOpen = ref(false)

const settings = useSettingsMessages()
const editorElement = useTemplateRef('editorElement')
const form = useMCPConnectionForm(settings, automation)
const { draft, errors: fieldErrors } = form
const connection = useMCPConnectionSettings(draft, tokenDraft, automation)
const { tokenStatus, error, saveResult, clearCredential } = connection
watch(
  () => Boolean(tokenDraft.value.trim() || tokenStatus.value === 'configured'),
  form.setCredentialReady,
  { immediate: true, flush: 'sync' }
)
const dirty = computed(
  () => form.dirty.value || tokenDraft.value.length > 0 || connection.credentialCleared.value
)
const busy = computed(() => connection.busy.value || form.isSubmitting.value)
useSettingsFormGuard(
  {
    dirty,
    busy,
    cancel,
    crumb: {
      parent: () => automation.value.connections,
      title: () =>
        draft.value.id ? automation.value.editConnection : automation.value.addServerConnection
    }
  },
  editing
)
function startAdd() {
  connection.startAdd()
  editing.value = true
}
async function startEdit(id: string) {
  if (await connection.startEdit(id)) editing.value = true
}
function cancel() {
  editing.value = false
}
/**
 * The draft and token are cleared once the editor has slid away, so it never shows them emptying;
 * an editor opened again meanwhile has set its own.
 */
function closed() {
  if (!editing.value) connection.cancel()
}
const submit = form.handleSubmit(async () => {
  if ((await connection.save()) === 'saved') cancel()
})
async function save() {
  if (busy.value) return
  await submit()
  await editorElement.value?.focusInvalid()
}
async function remove() {
  if (await connection.remove()) cancel()
  deleteOpen.value = false
}
</script>

<template>
  <PanelDrillIn :open="editing" @closed="closed">
    <template #detail>
      <MCPConnectionEditor
        ref="editorElement"
        v-model:draft="draft"
        v-model:token="tokenDraft"
        :token-status="tokenStatus"
        :error="error"
        :save-result="saveResult"
        :field-errors="fieldErrors"
        :busy="busy"
        @cancel="cancel"
        @save="save"
        @blur-field="form.blur"
        @remove="deleteOpen = true"
        @clear="clearCredential"
      />
    </template>
    <SettingsPage>
      <div class="flex flex-col gap-6">
        <slot />
        <SettingsSection :aria-busy="busy" data-mcp-connections>
          <template #title>{{ automation.connections }}</template>
          <template #description>
            {{ automation.connectionsDescription }}
            <SettingsLink :href="MCP_CONNECTIONS_DOCS_URL">{{ common.learnMore }}</SettingsLink>
          </template>
          <template #actions>
            <AppButton variant="outline" :loading="busy" @click="startAdd">
              <template #leading><icon-lucide-plus class="size-3.5" /></template>
              {{ automation.addConnection }}
            </AppButton>
          </template>
          <div v-if="mcpConnectionSettings.connections.length" class="flex flex-col gap-1.5">
            <AppActionRow
              v-for="item in mcpConnectionSettings.connections"
              :key="item.id"
              :disabled="busy"
              @click="startEdit(item.id)"
            >
              <template #leading><icon-lucide-plug class="size-3.5" /></template>
              {{ item.name }}
              <template #description>{{ item.transport.url }}</template>
              <template #trailing>
                <span class="text-xs">{{ item.enabled ? common.enabled : common.disabled }}</span>
                <icon-lucide-chevron-right class="size-3.5" />
              </template>
            </AppActionRow>
          </div>
          <AppPlaceholder v-else size="compact" :fill="false" :label="automation.noConnections" />
        </SettingsSection>
      </div>
    </SettingsPage>
  </PanelDrillIn>
  <AppAlertDialogRoot v-model:open="deleteOpen">
    <AppDialogHeader
      :heading="automation.deleteConnection"
      :description="automation.deleteConnectionDescription"
      :show-close="false"
    />
    <AppDialogFooter>
      <AlertDialogCancel as-child>
        <AppButton>{{ common.cancel }}</AppButton>
      </AlertDialogCancel>
      <AlertDialogAction as-child>
        <AppButton color="error" variant="solid" :loading="busy" @click="remove">
          {{ automation.deleteConnection }}
        </AppButton>
      </AlertDialogAction>
    </AppDialogFooter>
  </AppAlertDialogRoot>
</template>
