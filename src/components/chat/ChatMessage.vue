<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { Markdown } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'

import type { UIMessage } from 'ai'

const { message } = defineProps<{ message: UIMessage }>()

function getTextContent(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

interface ToolPart {
  type: string
  toolCallId: string
  state: string
  input?: unknown
  output?: unknown
  errorText?: string
}

function isToolPart(part: unknown): part is ToolPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    typeof (part as ToolPart).type === 'string' &&
    (part as ToolPart).type.startsWith('tool-')
  )
}

function getToolParts(msg: UIMessage): ToolPart[] {
  return msg.parts.filter(isToolPart)
}

function toolName(part: ToolPart): string {
  return part.type.replace(/^tool-/, '')
}

function toolDisplayName(part: ToolPart): string {
  return toolName(part)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function toolState(part: ToolPart): 'pending' | 'done' | 'error' {
  if (part.state === 'error') return 'error'
  if (part.state === 'output-available') return 'done'
  return 'pending'
}
</script>

<template>
  <div
    :data-test-id="`chat-message-${message.role}`"
    :class="message.role === 'user' ? 'flex justify-end' : ''"
  >
    <div class="min-w-0 space-y-1.5" :class="message.role === 'user' ? 'max-w-[85%]' : ''">
      <!-- Tool timeline -->
      <div
        v-if="message.role === 'assistant' && getToolParts(message).length > 0"
        data-test-id="chat-tool-timeline"
        class="space-y-0.5 rounded-lg border border-border bg-canvas p-2"
      >
        <CollapsibleRoot v-for="tool in getToolParts(message)" :key="tool.toolCallId">
          <CollapsibleTrigger
            class="flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-hover"
          >
            <div
              class="flex size-4 items-center justify-center rounded-full"
              :class="{
                'bg-accent/20 text-accent': toolState(tool) === 'pending',
                'bg-green-500/20 text-green-400': toolState(tool) === 'done',
                'bg-red-500/20 text-red-400': toolState(tool) === 'error'
              }"
            >
              <icon-lucide-loader-circle
                v-if="toolState(tool) === 'pending'"
                class="size-3 animate-spin"
              />
              <icon-lucide-check v-else-if="toolState(tool) === 'done'" class="size-3" />
              <icon-lucide-triangle-alert v-else class="size-3" />
            </div>
            <span class="text-[11px] text-surface">
              {{ toolDisplayName(tool) }}
            </span>
            <span class="text-[10px] text-muted">
              {{
                toolState(tool) === 'pending'
                  ? 'Running…'
                  : toolState(tool) === 'done'
                    ? 'Done'
                    : 'Error'
              }}
            </span>
            <icon-lucide-chevron-down
              v-if="toolState(tool) !== 'pending'"
              class="ml-auto size-3 text-muted transition-transform [[data-state=open]>&]:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent
            v-if="toolState(tool) !== 'pending'"
            class="overflow-hidden text-[10px] data-[state=closed]:collapsible-up data-[state=open]:collapsible-down"
          >
            <pre class="mt-1 overflow-x-auto rounded bg-input p-2 text-muted">{{
              tool.state === 'error' && tool.errorText
                ? tool.errorText
                : JSON.stringify(tool.output, null, 2)
            }}</pre>
          </CollapsibleContent>
        </CollapsibleRoot>
      </div>

      <!-- Text bubble -->
      <div
        v-if="getTextContent(message)"
        data-test-id="chat-text-bubble"
        class="rounded-xl px-3 py-2 text-xs leading-relaxed"
        :class="
          message.role === 'user'
            ? 'whitespace-pre-wrap rounded-br-md bg-accent text-white'
            : 'rounded-tl-md bg-hover text-surface'
        "
      >
        <Markdown
          v-if="message.role === 'assistant'"
          :content="getTextContent(message)"
          class="chat-markdown"
        />
        <template v-else>{{ getTextContent(message) }}</template>
      </div>
    </div>
  </div>
</template>
