<script setup lang="ts">
import { computed } from 'vue'
import { isTextUIPart, isToolUIPart, getToolName } from 'ai'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { Markdown } from 'vue-stream-markdown'
import { useI18n, vTestId } from '@open-pencil/vue'
import 'vue-stream-markdown/index.css'

import {
  imageAttachmentsForMessage,
  visibleUserMessageText
} from '@/app/ai/attachment/image/presentation'
import ImageAttachment from '@/components/chat/attachment/image/ImageAttachment.vue'
import { resolvedAppTheme } from '@/app/shell/theme'
import { classifyToolState } from './tool-state'

import type { UIDataTypes, UIMessage, UIMessagePart, UITools } from 'ai'

const { message, removable = true, streaming = false } = defineProps<{
  message: UIMessage
  removable?: boolean
  streaming?: boolean
}>()
const emit = defineEmits<{
  removeMessage: []
  removePart: [partKey: string]
}>()
const { dialogs } = useI18n()
const isDark = computed(() => resolvedAppTheme.value === 'dark')
const markdownMode = computed(() => (streaming ? 'streaming' : 'static'))
const imageAttachments = imageAttachmentsForMessage(message.id)

type ToolPart = Extract<UIMessagePart<UIDataTypes, UITools>, { toolCallId: string }>
type ToolImage = { url: string; mimeType: string; byteLength?: number }

function toolDisplayName(part: ToolPart): string {
  return getToolName(part)
    .replace(/^mcp__[^_]+__/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function toolTechnicalName(part: ToolPart): string {
  return getToolName(part)
}

function formatToolValue(value: unknown): string {
  const formatted = JSON.stringify(value, null, 2)
  return formatted ?? String(value)
}

function toolImage(output: unknown): ToolImage | null {
  if (!output || typeof output !== 'object') return null
  if (!('base64' in output) || !('mimeType' in output)) return null
  if (typeof output.base64 !== 'string' || typeof output.mimeType !== 'string') return null
  if (!output.mimeType.startsWith('image/')) return null
  return {
    url: `data:${output.mimeType};base64,${output.base64}`,
    mimeType: output.mimeType,
    byteLength:
      'byteLength' in output && typeof output.byteLength === 'number'
        ? output.byteLength
        : undefined
  }
}

function formatToolOutput(output: unknown): string {
  const image = toolImage(output)
  if (!image) return formatToolValue(output)
  return formatToolValue({ mimeType: image.mimeType, byteLength: image.byteLength })
}

function hasErrorOutput(part: ToolPart): boolean {
  return (
    part.state === 'output-available' &&
    typeof part.output === 'object' &&
    part.output !== null &&
    'error' in part.output
  )
}

function toolState(part: ToolPart): 'pending' | 'done' | 'error' {
  return classifyToolState({
    toolName: getToolName(part),
    state: part.state,
    output: part.output
  })
}

function partKey(part: UIMessagePart<UIDataTypes, UITools>, index: number): string {
  if ('toolCallId' in part) return part.toolCallId
  return `part-${index}`
}
</script>

<template>
  <div
    v-test-id="`chat-message-${message.role}`"
    class="group/message relative"
    :class="message.role === 'user' ? 'flex justify-end' : ''"
  >
    <button
      v-if="removable"
      v-test-id="'chat-remove-message'"
      type="button"
      :aria-label="dialogs.removeChatMessage"
      class="absolute -top-2 z-10 flex size-5 items-center justify-center rounded-full border border-border bg-canvas text-muted opacity-0 shadow-sm transition-opacity group-hover/message:opacity-100 hover:bg-hover hover:text-surface focus:opacity-100"
      :class="message.role === 'user' ? 'right-0' : '-left-2'"
      @click="emit('removeMessage')"
    >
      <icon-lucide-x class="size-3" />
    </button>
    <div
      class="min-w-0 space-y-2 select-text"
      :class="message.role === 'user' ? 'max-w-[85%]' : ''"
    >
      <template v-if="message.role === 'assistant'">
        <template v-for="(part, i) in message.parts" :key="partKey(part, i)">
          <!-- Tool call -->
          <div
            v-if="isToolUIPart(part)"
            class="group/tool relative rounded-lg border border-border bg-canvas p-2"
          >
            <button
              v-if="removable"
              v-test-id="'chat-remove-tool-execution'"
              type="button"
              :aria-label="dialogs.removeToolExecution"
              class="absolute top-1.5 right-1.5 z-10 flex size-5 items-center justify-center rounded text-muted opacity-0 transition-opacity group-hover/tool:opacity-100 hover:bg-hover hover:text-surface focus:opacity-100"
              @click.stop="emit('removePart', partKey(part, i))"
            >
              <icon-lucide-x class="size-3" />
            </button>
            <CollapsibleRoot>
              <CollapsibleTrigger
                class="flex w-full items-center gap-2 rounded px-1 py-0.5 pr-6 hover:bg-hover"
              >
                <div
                  class="flex size-4 items-center justify-center rounded-full"
                  :class="{
                    'bg-accent/20 text-accent': toolState(part) === 'pending',
                    'bg-green-500/20 text-green-400': toolState(part) === 'done',
                    'bg-red-500/20 text-red-400': toolState(part) === 'error'
                  }"
                >
                  <icon-lucide-loader-circle
                    v-if="toolState(part) === 'pending'"
                    class="size-3 animate-spin"
                  />
                  <icon-lucide-check v-else-if="toolState(part) === 'done'" class="size-3" />
                  <icon-lucide-triangle-alert v-else class="size-3" />
                </div>
                <span class="text-[11px] text-surface">
                  {{ toolDisplayName(part) }}
                </span>
                <code class="rounded bg-input px-1 py-0.5 text-[9px] text-muted">
                  {{ toolTechnicalName(part) }}
                </code>
                <span class="text-[10px] text-muted">
                  {{
                    toolState(part) === 'pending'
                      ? dialogs.toolRunning
                      : toolState(part) === 'done'
                        ? dialogs.toolFinished
                        : dialogs.toolError
                  }}
                </span>
                <icon-lucide-chevron-down
                  class="ml-auto size-3 text-muted transition-transform [[data-state=open]>&]:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent
                class="data-[state=closed]:collapsible-up data-[state=open]:collapsible-down overflow-hidden text-[10px]"
              >
                <div class="mt-1 space-y-1.5">
                  <div>
                    <div class="mb-1 font-medium text-muted">{{ dialogs.toolInput }}</div>
                    <pre class="overflow-x-auto rounded bg-input p-2 text-muted">{{
                      formatToolValue(part.input)
                    }}</pre>
                  </div>
                  <div v-if="part.state === 'output-available' || part.state === 'output-error'">
                    <div v-if="part.state === 'output-available' && toolImage(part.output)">
                      <div class="mb-1 font-medium text-muted">
                        {{ dialogs.toolImageSentToAI }}
                      </div>
                      <div class="mb-1.5 overflow-hidden rounded bg-input p-2">
                        <img
                          :src="toolImage(part.output)?.url"
                          :alt="dialogs.toolImageSentToAI"
                          class="max-h-80 w-full object-contain"
                        />
                      </div>
                    </div>
                    <div class="mb-1 font-medium text-muted">{{ dialogs.toolOutput }}</div>
                    <pre class="overflow-x-auto rounded bg-input p-2 text-muted">{{
                      part.state === 'output-error' ? part.errorText : formatToolOutput(part.output)
                    }}</pre>
                  </div>
                </div>
              </CollapsibleContent>
            </CollapsibleRoot>
          </div>

          <!-- Text -->
          <div
            v-else-if="isTextUIPart(part) && part.text"
            data-test-id="chat-text-bubble"
            class="rounded-xl rounded-tl-md bg-hover px-3 py-2 text-xs leading-relaxed text-surface"
          >
            <Markdown
              :key="markdownMode"
              :content="part.text"
              :is-dark="isDark"
              :mermaid="false"
              :mode="markdownMode"
              :data-chat-markdown-mode="markdownMode"
              class="chat-markdown [&_[data-stream-markdown=code]]:!bg-input"
            />
          </div>
        </template>
      </template>

      <!-- User message -->
      <template v-else-if="message.role === 'user'">
        <div v-if="imageAttachments.length" class="flex flex-wrap justify-end gap-1.5">
          <ImageAttachment
            v-for="attachment in imageAttachments"
            :key="attachment.id"
            :attachment="attachment"
          />
        </div>
        <div
          data-test-id="chat-text-bubble"
          class="rounded-xl rounded-br-md bg-accent px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-white"
        >
          {{
            visibleUserMessageText(
              message.id,
              message.parts
                .filter(isTextUIPart)
                .map((p) => p.text)
                .join('')
            )
          }}
        </div>
      </template>
    </div>
  </div>
</template>
