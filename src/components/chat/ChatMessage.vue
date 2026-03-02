<script setup lang="ts">
import { Markdown } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'
import { computed, ref } from 'vue'

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements'

import type { UIMessage } from 'ai'

const props = defineProps<{
  message: UIMessage
  isStreaming?: boolean
}>()

// ── Part extraction ──────────────────────────────────────────
function getTextParts(msg: UIMessage) {
  return msg.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
}

function getReasoningParts(msg: UIMessage) {
  return msg.parts.filter(
    (p): p is { type: 'reasoning'; text: string } =>
      typeof p === 'object' && p !== null && 'type' in p && (p as { type: string }).type === 'reasoning'
  )
}

interface ToolPart {
  type: string
  toolCallId: string
  state: string
  toolName?: string
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

function toolDisplayName(part: ToolPart): string {
  const raw = part.toolName ?? part.type.replace(/^tool-/, '').replace(/-call$|-result$/, '')
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function toolState(part: ToolPart): 'pending' | 'done' | 'error' {
  if (part.state === 'error') return 'error'
  if (part.state === 'output-available' || part.state === 'result') return 'done'
  return 'pending'
}

// ── Copy ────────────────────────────────────────────────────
const copied = ref(false)
const fullText = computed(() =>
  getTextParts(props.message)
    .map((p) => p.text)
    .join('')
)

async function copyMessage() {
  if (!fullText.value) return
  await navigator.clipboard.writeText(fullText.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}

// ── File attachments ─────────────────────────────────────────
interface FilePart {
  type: 'file'
  mediaType?: string
  url?: string
  filename?: string
}

function getFileParts(msg: UIMessage): FilePart[] {
  return msg.parts.filter(
    (p): p is FilePart =>
      typeof p === 'object' && p !== null && 'type' in p && (p as FilePart).type === 'file'
  )
}

const isUser = computed(() => props.message.role === 'user')
const hasContent = computed(() => fullText.value.length > 0)
const toolParts = computed(() => getToolParts(props.message))
const reasoningParts = computed(() => getReasoningParts(props.message))
const fileParts = computed(() => getFileParts(props.message))
</script>

<template>
  <div :class="['group flex w-full gap-2', isUser ? 'flex-row-reverse' : 'flex-row']">
    <!-- Avatar -->
    <div class="mt-0.5 shrink-0">
      <div
        v-if="isUser"
        class="flex size-6 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent"
      >
        U
      </div>
      <div
        v-else
        class="flex size-6 items-center justify-center rounded-full bg-accent/10"
      >
        <icon-lucide-sparkles class="size-3 text-accent" />
      </div>
    </div>

    <!-- Content -->
    <div
      :class="['relative min-w-0 flex-1 space-y-1.5', isUser ? 'items-end' : 'items-start']"
      style="max-width: calc(100% - 2rem)"
    >
      <!-- File attachments (user) -->
      <div v-if="fileParts.length > 0" class="flex flex-wrap gap-1.5">
        <div
          v-for="(f, i) in fileParts"
          :key="i"
          class="relative overflow-hidden rounded-lg border border-border bg-hover"
        >
          <img
            v-if="f.mediaType?.startsWith('image/') && f.url"
            :src="f.url"
            :alt="f.filename ?? 'attachment'"
            class="h-20 w-auto max-w-[160px] object-cover"
          />
          <div v-else class="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted">
            <icon-lucide-file class="size-3" />
            {{ f.filename ?? 'file' }}
          </div>
        </div>
      </div>

      <!-- Reasoning (ai-elements-vue) -->
      <Reasoning
        v-for="(r, i) in reasoningParts"
        :key="i"
        :is-streaming="isStreaming && i === reasoningParts.length - 1"
      >
        <ReasoningTrigger />
        <ReasoningContent :content="r.text" />
      </Reasoning>

      <!-- Tool calls (ai-elements-vue) -->
      <div v-if="!isUser && toolParts.length > 0" class="space-y-1">
        <Tool v-for="tool in toolParts" :key="tool.toolCallId">
          <ToolHeader :type="tool.type as any" :state="tool.state" />
          <ToolContent>
            <ToolInput :input="tool.input" />
            <ToolOutput :output="tool.output" :error-text="tool.errorText" />
          </ToolContent>
        </Tool>
      </div>

      <!-- Text bubble -->
      <div
        v-if="hasContent"
        class="relative"
        :class="isUser ? 'flex justify-end' : ''"
      >
        <div
          :class="[
            'min-w-0 rounded-xl px-3 py-2 text-xs leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-accent text-white'
              : 'rounded-tl-sm bg-hover text-surface'
          ]"
        >
          <Markdown
            v-if="!isUser"
            :content="fullText"
            :mode="isStreaming ? 'streaming' : 'static'"
            :theme="['github-dark', 'github-dark']"
            class="chat-markdown"
          />
          <span v-else class="whitespace-pre-wrap">{{ fullText }}</span>
        </div>

        <!-- Copy button — appears on hover for assistant messages -->
        <button
          v-if="!isUser && hasContent"
          class="absolute -bottom-5 left-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition-all hover:bg-hover hover:text-surface group-hover:opacity-100"
          :title="copied ? 'Copied!' : 'Copy'"
          @click="copyMessage"
        >
          <icon-lucide-check v-if="copied" class="size-3 text-green-400" />
          <icon-lucide-copy v-else class="size-3" />
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/* Ensure vue-stream-markdown code blocks respect our dark theme */
.chat-markdown pre {
  background: var(--color-input) !important;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 11px;
}

.chat-markdown code:not(pre code) {
  background: var(--color-input);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 1px 4px;
  font-size: 10px;
}

.chat-markdown p {
  margin: 0 0 0.5em;
}

.chat-markdown p:last-child {
  margin-bottom: 0;
}

.chat-markdown h1,
.chat-markdown h2,
.chat-markdown h3 {
  font-weight: 600;
  margin: 0.75em 0 0.25em;
  color: var(--color-surface);
}

.chat-markdown ul,
.chat-markdown ol {
  padding-left: 1.25em;
  margin: 0.25em 0;
}

.chat-markdown li {
  margin: 0.15em 0;
}
</style>
