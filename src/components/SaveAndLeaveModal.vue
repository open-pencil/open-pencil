<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'

import { useI18n } from '@inkly/vue'
import { createBoard } from '@/app/api/client'
import { toast } from '@/app/shell/ui'
import { useDialogUI } from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { required: true })

const { documentName = '' } = defineProps<{
  documentName?: string
}>()

const router = useRouter()
const saving = ref(false)
const { saveAndLeaveModal: t } = useI18n()
const cls = useDialogUI({
  content: 'w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-5 shadow-2xl'
})

const resolvedName = computed(() => documentName.trim() || t.value.untitledName)
const descriptionLine2 = computed(() => t.value.descriptionLine2({ name: resolvedName.value }))

async function saveAndLeave() {
  if (saving.value) return
  saving.value = true
  try {
    const board = await createBoard({ name: resolvedName.value })
    toast.info(t.value.toastAdded({ name: board.name }))
    open.value = false
    await router.replace({ path: '/dashboard' })
  } catch (error) {
    console.error('[SaveAndLeave]', error)
    const message = error instanceof Error ? error.message : t.value.errorFallback
    toast.error(message)
  } finally {
    saving.value = false
  }
}

async function discardAndLeave() {
  open.value = false
  await router.push('/dashboard')
}

function cancel() {
  open.value = false
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent :class="cls.content" data-test-id="save-and-leave-modal">
        <DialogTitle :class="cls.title" class="text-base">
          {{ t.title }}
        </DialogTitle>
        <DialogDescription :class="cls.description" class="mt-2 leading-relaxed">
          {{ t.descriptionLine1 }}<br />
          {{ descriptionLine2 }}
        </DialogDescription>

        <div class="mt-5 flex flex-col gap-2">
          <button
            type="button"
            class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving"
            data-test-id="save-and-leave-confirm"
            @click="saveAndLeave"
          >
            {{ saving ? t.buttonSaving : t.buttonSave }}
          </button>
          <button
            type="button"
            class="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm text-surface transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving"
            data-test-id="save-and-leave-discard"
            @click="discardAndLeave"
          >
            {{ t.buttonDiscard }}
          </button>
          <button
            type="button"
            class="w-full rounded-lg px-4 py-2.5 text-sm text-muted transition-colors hover:text-surface disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving"
            data-test-id="save-and-leave-cancel"
            @click="cancel"
          >
            {{ t.buttonCancel }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
