<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { nextTick, ref, watch } from 'vue'
import { useI18n } from '@open-pencil/vue'

import { activePrompt, cancelActivePrompt } from '@/app/shell/prompts'
import { useDialogUI } from '@/components/ui/dialog'

const { dialogs } = useI18n()
const cls = useDialogUI({ content: 'w-[min(22rem,92vw)] p-4' })

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(activePrompt, (next) => {
  if (next?.kind === 'prompt') {
    inputValue.value = next.initial
    void nextTick(() => inputRef.value?.select())
  }
})

function onOpenChange(open: boolean) {
  if (!open) cancelActivePrompt()
}

function submit() {
  const current = activePrompt.value
  if (!current) return
  if (current.kind === 'confirm') current.resolve(true)
  else current.resolve(inputValue.value)
}

function onEnter(e: KeyboardEvent) {
  // Enter that commits an IME composition must not submit the dialog
  if (e.isComposing) return
  submit()
}
</script>

<template>
  <DialogRoot :open="activePrompt != null" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent :class="cls.content" data-test-id="app-prompt-dialog">
        <template v-if="activePrompt">
          <DialogTitle :class="cls.title">
            {{ activePrompt.kind === 'confirm' ? activePrompt.message : activePrompt.title }}
          </DialogTitle>
          <input
            v-if="activePrompt.kind === 'prompt'"
            ref="inputRef"
            v-model="inputValue"
            type="text"
            :aria-label="activePrompt.title"
            class="mt-3 w-full rounded border border-border bg-input px-2 py-1.5 text-sm text-surface outline-none focus:border-accent"
            data-test-id="app-prompt-input"
            @keydown.enter.prevent="onEnter"
          />
          <!-- Cancel is first tabbable on purpose: Enter must not confirm a
               destructive action by default -->
          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="rounded border border-border px-3 py-1.5 text-[11px] font-medium text-surface hover:bg-hover"
              data-test-id="app-prompt-cancel"
              @click="cancelActivePrompt"
            >
              {{ dialogs.cancel }}
            </button>
            <button
              type="button"
              class="rounded px-3 py-1.5 text-[11px] font-medium text-white"
              :class="
                activePrompt.kind === 'confirm' && activePrompt.danger
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-accent hover:bg-accent/90'
              "
              data-test-id="app-prompt-confirm"
              @click="submit"
            >
              {{ activePrompt.kind === 'confirm' ? activePrompt.confirmLabel : dialogs.ok }}
            </button>
          </div>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
