<script setup lang="ts">
import { AlertDialogAction, AlertDialogCancel } from 'reka-ui'
import * as v from 'valibot'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'
import { acpPermissionOptionTestId, vTestId } from '@open-pencil/vue/testing'

import {
  currentPermission,
  rejectCurrentPermission,
  respondToPermission
} from '@/app/ai/agents/acp/permission'
import MarkdownContent from '@/components/markdown/MarkdownContent.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { AppAlertDialogRoot, AppDialogBody, AppDialogHeader } from '@/components/ui/dialog'
import { useHeldContent } from '@/components/ui/overlay/held'

const open = computed(() => currentPermission.value !== null)
// Answering clears the request; the dialog keeps showing it while it animates closed.
const permission = useHeldContent(currentPermission)
const { ai } = useI18n()
interface ToolCallInfo {
  title?: string
  rawInput?: unknown
}

const toolCall = computed(
  (): ToolCallInfo => (permission.value?.request.toolCall as ToolCallInfo) ?? {}
)

const toolName = computed(() => toolCall.value.title ?? ai.value.unknownTool)

/** A plan the agent asks to carry out, as Claude Code's leaves Plan mode with, shown as Markdown. */
const planInputSchema = v.object({ plan: v.pipe(v.string(), v.nonEmpty()) })
const plan = computed(() => {
  const input = v.safeParse(planInputSchema, toolCall.value.rawInput)
  return input.success ? input.output.plan : null
})

const toolInput = computed(() => {
  const raw = toolCall.value.rawInput
  if (!raw || plan.value) return null
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return String(raw)
  }
})

const allowOptions = computed(
  () => permission.value?.request.options.filter((o) => o.kind.startsWith('allow')) ?? []
)

const rejectOptions = computed(
  () => permission.value?.request.options.filter((o) => o.kind.startsWith('reject')) ?? []
)

function handleDismiss() {
  rejectCurrentPermission()
}
</script>

<template>
  <AppAlertDialogRoot
    :open="open"
    :size="plan ? 'md' : 'sm'"
    data-test-id="acp-permission-dialog"
    @overlay-click="handleDismiss"
    @escape-key-down="handleDismiss"
  >
    <AppDialogHeader
      :heading="ai.permissionRequestTitle"
      :description="ai.permissionRequest({ tool: toolName })"
      :show-close="false"
    />
    <AppDialogBody v-if="plan || toolInput" :ui="{ body: 'pb-0' }">
      <MarkdownContent
        v-if="plan"
        :key="permission?.request.toolCall.toolCallId"
        :content="plan"
        density="compact"
        class="max-h-72 overflow-auto rounded-md bg-input px-3 py-2 text-xs"
      />
      <pre v-else class="max-h-32 overflow-auto rounded-md bg-input p-2 text-3xs text-muted">{{
        toolInput
      }}</pre>
    </AppDialogBody>

    <!-- The agent's first allowing answer leads; its others and the refusal stay quieter. -->
    <div class="flex flex-col gap-1.5 p-4">
      <AlertDialogAction
        v-for="(opt, index) in allowOptions"
        :key="opt.optionId"
        v-test-id="acpPermissionOptionTestId(opt.kind)"
        as-child
      >
        <AppButton
          :color="index === 0 ? 'primary' : 'neutral'"
          :variant="index === 0 ? 'solid' : 'outline'"
          size="md"
          class="h-auto min-h-8 w-full py-1.5 whitespace-normal text-center"
          @click="respondToPermission(opt.optionId)"
        >
          {{ opt.name }}
        </AppButton>
      </AlertDialogAction>

      <AlertDialogCancel
        v-for="opt in rejectOptions"
        :key="opt.optionId"
        v-test-id="acpPermissionOptionTestId(opt.kind)"
        as-child
      >
        <AppButton
          size="md"
          class="h-auto min-h-8 w-full py-1.5 whitespace-normal"
          @click="respondToPermission(opt.optionId)"
        >
          {{ opt.name }}
        </AppButton>
      </AlertDialogCancel>
    </div>
  </AppAlertDialogRoot>
</template>
