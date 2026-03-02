<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

import { MODELS, useAIChat } from '@/composables/use-chat'

import type { ChatStatus } from 'ai'

const { modelId, thinkingEnabled, currentModel, resetChat } = useAIChat()

const props = defineProps<{
  status: ChatStatus
}>()

const emit = defineEmits<{
  submit: [text: string, files?: FileList]
  stop: []
}>()

// ── Input ────────────────────────────────────────────────────
const input = ref('')
const textareaEl = ref<HTMLTextAreaElement>()
const fileInputEl = ref<HTMLInputElement>()
const focused = ref(false)

const isStreaming = computed(
  () => props.status === 'streaming' || props.status === 'submitted'
)
const canSubmit = computed(() => input.value.trim().length > 0 || attachments.value.length > 0)

watch(input, () => {
  nextTick(() => {
    const el = textareaEl.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  })
})

// ── Attachments ──────────────────────────────────────────────
interface Attachment {
  id: string
  file: File
  url: string
  isImage: boolean
}

const attachments = ref<Attachment[]>([])

function addFiles(fileList: FileList | File[]) {
  for (const file of fileList) {
    attachments.value.push({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      isImage: file.type.startsWith('image/'),
    })
  }
}

function removeAttachment(id: string) {
  const idx = attachments.value.findIndex((a) => a.id === id)
  if (idx !== -1) {
    URL.revokeObjectURL(attachments.value[idx].url)
    attachments.value.splice(idx, 1)
  }
}

function clearAttachments() {
  for (const a of attachments.value) URL.revokeObjectURL(a.url)
  attachments.value = []
}

onUnmounted(clearAttachments)

function handleFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) addFiles(files)
  ;(e.target as HTMLInputElement).value = ''
}

function handlePaste(e: ClipboardEvent) {
  const files = [...(e.clipboardData?.items ?? [])]
    .filter((i) => i.kind === 'file')
    .map((i) => i.getAsFile())
    .filter((f): f is File => f !== null)
  if (files.length) {
    e.preventDefault()
    addFiles(files)
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (files?.length) addFiles(files)
}

function handleDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
}

// ── Voice input ──────────────────────────────────────────────
const isListening = ref(false)
let recognition: InstanceType<typeof SpeechRecognition> | null = null

const hasSpeechRecognition =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

function toggleVoice() {
  if (isListening.value) {
    recognition?.stop()
    return
  }
  const SR =
    (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
    (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
  if (!SR) return

  recognition = new SR()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'

  let baseText = input.value
  recognition.onstart = () => { isListening.value = true; baseText = input.value }
  recognition.onresult = (event: SpeechRecognitionEvent) => {
    input.value = baseText + (baseText ? ' ' : '') + [...event.results].map((r) => r[0].transcript).join('')
  }
  recognition.onend = () => { isListening.value = false; recognition = null }
  recognition.onerror = () => { isListening.value = false; recognition = null }
  recognition.start()
}

onUnmounted(() => recognition?.stop())

// ── Submit ───────────────────────────────────────────────────
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    if (canSubmit.value && !isStreaming.value) submit()
  }
}

function buildFileList(): FileList | undefined {
  if (!attachments.value.length) return undefined
  const dt = new DataTransfer()
  for (const a of attachments.value) dt.items.add(a.file)
  return dt.files
}

function submit() {
  const text = input.value.trim()
  if (!text && !attachments.value.length) return
  emit('submit', text, buildFileList())
  input.value = ''
  clearAttachments()
  nextTick(() => { if (textareaEl.value) textareaEl.value.style.height = 'auto' })
}

// ── Model + thinking ─────────────────────────────────────────
const selectedModelName = computed(
  () => MODELS.find((m) => m.id === modelId.value)?.name ?? modelId.value
)

watch([modelId, thinkingEnabled], () => resetChat())

const canThink = computed(() => currentModel.value?.supportsThinking ?? false)
const canAttach = computed(() => currentModel.value?.supportsVision ?? true)
</script>

<template>
  <TooltipProvider>
    <div
      class="shrink-0 p-2.5"
      @dragover="handleDragOver"
      @drop="handleDrop"
    >
      <!-- Unified input card -->
      <div
        class="flex flex-col rounded-xl border bg-input transition-colors"
        :class="focused ? 'border-accent/60' : 'border-border'"
      >
        <!-- Attachment strip (inside card, above textarea) -->
        <div
          v-if="attachments.length > 0"
          class="flex flex-wrap gap-1.5 border-b border-border px-3 pt-2.5 pb-2"
        >
          <div
            v-for="a in attachments"
            :key="a.id"
            class="group relative overflow-hidden rounded-lg border border-border"
          >
            <img
              v-if="a.isImage"
              :src="a.url"
              :alt="a.file.name"
              class="h-14 w-auto max-w-[120px] object-cover"
            />
            <div v-else class="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-muted">
              <icon-lucide-file class="size-3 shrink-0" />
              <span class="max-w-[80px] truncate">{{ a.file.name }}</span>
            </div>
            <button
              class="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-canvas/80 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-surface"
              @click="removeAttachment(a.id)"
            >
              <icon-lucide-x class="size-2.5" />
            </button>
          </div>
        </div>

        <!-- Textarea -->
        <textarea
          ref="textareaEl"
          v-model="input"
          rows="2"
          placeholder="Describe a change…"
          class="w-full resize-none bg-transparent px-3 pt-3 pb-1 text-xs text-surface outline-none placeholder:text-muted disabled:opacity-50"
          :disabled="isStreaming"
          style="field-sizing: content; max-height: 160px; min-height: 52px"
          @keydown="handleKeyDown"
          @paste="handlePaste"
          @focus="focused = true"
          @blur="focused = false"
        />

        <!-- Bottom toolbar -->
        <div class="flex items-center gap-1 px-2 pb-2 pt-1">
          <!-- Model selector -->
          <SelectRoot v-model="modelId">
            <SelectTrigger
              class="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-muted hover:bg-hover hover:text-surface transition-colors"
            >
              <icon-lucide-cpu class="size-3" />
              <span>{{ selectedModelName }}</span>
              <icon-lucide-chevron-down class="size-2.5" />
            </SelectTrigger>
            <SelectPortal>
              <SelectContent
                position="popper"
                side="top"
                :side-offset="6"
                class="z-50 max-h-64 min-w-[200px] overflow-y-auto rounded-lg border border-border bg-panel p-1 shadow-lg"
              >
                <SelectViewport>
                  <SelectItem
                    v-for="model in MODELS"
                    :key="model.id"
                    :value="model.id"
                    class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px] text-surface outline-none data-[highlighted]:bg-hover"
                  >
                    <SelectItemText class="flex-1">{{ model.name }}</SelectItemText>
                    <div class="flex items-center gap-1">
                      <icon-lucide-eye
                        v-if="model.supportsVision"
                        class="size-2.5 text-muted"
                        title="Vision"
                      />
                      <icon-lucide-brain
                        v-if="model.supportsThinking"
                        class="size-2.5 text-muted"
                        title="Thinking"
                      />
                      <span
                        v-if="model.tag"
                        class="rounded bg-accent/10 px-1 py-px text-[9px] text-accent"
                      >{{ model.tag }}</span>
                    </div>
                  </SelectItem>
                </SelectViewport>
              </SelectContent>
            </SelectPortal>
          </SelectRoot>

          <!-- Divider -->
          <span class="h-3 w-px bg-border mx-0.5" />

          <!-- Think toggle -->
          <TooltipRoot v-if="canThink">
            <TooltipTrigger as-child>
              <button
                :class="[
                  'flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] transition-colors',
                  thinkingEnabled ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-hover hover:text-surface'
                ]"
                @click="thinkingEnabled = !thinkingEnabled"
              >
                <icon-lucide-brain class="size-3" />
                Think
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent side="top" :side-offset="6" class="rounded bg-surface px-2 py-1 text-[10px] text-canvas">
                {{ thinkingEnabled ? 'Disable' : 'Enable' }} extended reasoning
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>

          <!-- Spacer -->
          <div class="flex-1" />

          <!-- Attach -->
          <TooltipRoot v-if="canAttach">
            <TooltipTrigger as-child>
              <button
                class="flex size-6 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-surface transition-colors"
                @click="fileInputEl?.click()"
              >
                <icon-lucide-paperclip class="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent side="top" :side-offset="6" class="rounded bg-surface px-2 py-1 text-[10px] text-canvas">
                Attach image
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>

          <!-- Voice -->
          <TooltipRoot v-if="hasSpeechRecognition">
            <TooltipTrigger as-child>
              <button
                :class="[
                  'flex size-6 items-center justify-center rounded-md transition-colors',
                  isListening ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'text-muted hover:bg-hover hover:text-surface'
                ]"
                @click="toggleVoice"
              >
                <icon-lucide-mic-off v-if="isListening" class="size-3.5" />
                <icon-lucide-mic v-else class="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent side="top" :side-offset="6" class="rounded bg-surface px-2 py-1 text-[10px] text-canvas">
                {{ isListening ? 'Stop recording' : 'Voice input' }}
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>

          <!-- Divider -->
          <span class="h-3 w-px bg-border mx-0.5" />

          <!-- Stop / Send -->
          <TooltipRoot v-if="isStreaming">
            <TooltipTrigger as-child>
              <button
                class="flex size-6 items-center justify-center rounded-md border border-border text-muted hover:bg-hover hover:text-surface transition-colors"
                @click="emit('stop')"
              >
                <icon-lucide-square class="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent side="top" :side-offset="6" class="rounded bg-surface px-2 py-1 text-[10px] text-canvas">
                Stop generating
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
          <TooltipRoot v-else>
            <TooltipTrigger as-child>
              <button
                class="flex size-6 items-center justify-center rounded-md bg-accent text-white transition-opacity hover:bg-accent/90 disabled:opacity-35"
                :disabled="!canSubmit"
                @click="submit"
              >
                <icon-lucide-arrow-up class="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent side="top" :side-offset="6" class="rounded bg-surface px-2 py-1 text-[10px] text-canvas">
                Send (Enter)
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </div>
      </div>

      <!-- Recording indicator -->
      <p v-if="isListening" class="mt-1.5 text-center text-[9px] animate-pulse text-red-400">
        ● Recording — click mic to stop
      </p>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInputEl"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="handleFileChange"
    />
  </TooltipProvider>
</template>
