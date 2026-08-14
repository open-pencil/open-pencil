<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle
} from 'reka-ui'
import { computed } from 'vue'
import { acpPermissionOptionTestId, useI18n, vTestId } from '@open-pencil/vue'

import {
  currentPermission,
  rejectCurrentPermission,
  respondToPermission
} from '@/app/ai/acp/permission'
import { AppAlertDialogRoot } from '@/components/ui/dialog'

const open = computed(() => currentPermission.value !== null)
const { dialogs } = useI18n()
interface ToolCallInfo {
  title?: string
  rawInput?: unknown
}

const toolCall = computed(
  (): ToolCallInfo => (currentPermission.value?.request.toolCall as ToolCallInfo) ?? {}
)

const toolName = computed(() => toolCall.value.title ?? dialogs.value.unknownTool)

const toolInput = computed(() => {
  const raw = toolCall.value.rawInput
  if (!raw) return null
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return String(raw)
  }
})

const allowOptions = computed(
  () => currentPermission.value?.request.options.filter((o) => o.kind.startsWith('allow')) ?? []
)

const rejectOptions = computed(
  () => currentPermission.value?.request.options.filter((o) => o.kind.startsWith('reject')) ?? []
)

function handleDismiss() {
  rejectCurrentPermission()
}
</script>

<template>
  <AppAlertDialogRoot
    :open="open"
    :ui="{ overlay: 'z-50', content: 'w-80 rounded-lg p-4 shadow-xl' }"
    data-test-id="acp-permission-dialog"
    @overlay-click="handleDismiss"
    @escape-key-down="handleDismiss"
  >
    <AlertDialogTitle class="text-sm font-semibold text-surface">
      {{ dialogs.permissionRequestTitle }}
    </AlertDialogTitle>

    <AlertDialogDescription class="mt-2 text-xs text-muted">
      {{ dialogs.permissionRequest({ tool: toolName }) }}
    </AlertDialogDescription>

    <pre
      v-if="toolInput"
      class="mt-2 max-h-32 overflow-auto rounded bg-input p-2 text-[10px] text-muted"
      >{{ toolInput }}</pre
    >

    <div class="mt-4 flex flex-col gap-2">
      <AlertDialogAction
        v-for="opt in allowOptions"
        :key="opt.optionId"
        v-test-id="acpPermissionOptionTestId(opt.kind)"
        class="w-full rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        @click="respondToPermission(opt.optionId)"
      >
        {{ opt.name }}
      </AlertDialogAction>

      <AlertDialogCancel
        v-for="opt in rejectOptions"
        :key="opt.optionId"
        v-test-id="acpPermissionOptionTestId(opt.kind)"
        class="w-full rounded border border-border bg-canvas px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
        @click="respondToPermission(opt.optionId)"
      >
        {{ opt.name }}
      </AlertDialogCancel>
    </div>
  </AppAlertDialogRoot>
</template>
