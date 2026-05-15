<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle
} from 'reka-ui'
import { computed } from 'vue'
import { testId as testIdAttr } from '@open-pencil/vue'

import {
  currentPermission,
  rejectCurrentPermission,
  respondToPermission
} from '@/app/ai/acp/permission'
import { useDialogUI } from '@/components/ui/dialog'

const open = computed(() => currentPermission.value !== null)
const cls = useDialogUI({
  overlay: 'z-50',
  content: 'w-80 rounded-lg p-4 shadow-xl'
})

interface ToolCallInfo {
  title?: string
  rawInput?: unknown
}

const toolCall = computed(
  (): ToolCallInfo => (currentPermission.value?.request.toolCall as ToolCallInfo) ?? {}
)

const toolName = computed(() => toolCall.value.title ?? 'Unknown tool')

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
  <AlertDialogRoot :open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay :class="cls.overlay" @click="handleDismiss" />
      <AlertDialogContent
        data-test-id="acp-permission-dialog"
        :class="cls.content"
        @escape-key-down="handleDismiss"
      >
        <AlertDialogTitle class="text-sm font-semibold text-surface">
          Permission Request
        </AlertDialogTitle>

        <AlertDialogDescription class="mt-2 text-xs text-muted">
          <span class="font-medium text-surface">{{ toolName }}</span> is requesting permission.
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
            v-bind="testIdAttr(`acp-permission-option-${opt.kind}`)"
            class="w-full rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
            @click="respondToPermission(opt.optionId)"
          >
            {{ opt.name }}
          </AlertDialogAction>

          <AlertDialogCancel
            v-for="opt in rejectOptions"
            :key="opt.optionId"
            v-bind="testIdAttr(`acp-permission-option-${opt.kind}`)"
            class="w-full rounded border border-border bg-canvas px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
            @click="respondToPermission(opt.optionId)"
          >
            {{ opt.name }}
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
