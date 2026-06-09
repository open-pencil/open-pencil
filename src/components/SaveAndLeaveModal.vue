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

import { createBoard } from '@/app/api/client'
import { toast } from '@/app/shell/ui'
import { useDialogUI } from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { required: true })

const { documentName = '' } = defineProps<{
  documentName?: string
}>()

const router = useRouter()
const saving = ref(false)
const cls = useDialogUI({
  content: 'w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-5 shadow-2xl'
})

const resolvedName = computed(() => documentName.trim() || '無題のボード')

async function saveAndLeave() {
  if (saving.value) return
  saving.value = true
  try {
    const board = await createBoard({ name: resolvedName.value })
    toast.info(`「${board.name}」をダッシュボードに追加しました`)
    open.value = false
    await router.replace({ path: '/dashboard' })
  } catch (error) {
    console.error('[SaveAndLeave]', error)
    const message = error instanceof Error ? error.message : 'ダッシュボードへの追加に失敗しました'
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
          このボードをダッシュボードに追加しますか？
        </DialogTitle>
        <DialogDescription :class="cls.description" class="mt-2 leading-relaxed">
          現在のボードはまだダッシュボードに保存されていません。<br />
          「{{ resolvedName }}」 をダッシュボードに追加してから戻りますか？
        </DialogDescription>

        <div class="mt-5 flex flex-col gap-2">
          <button
            type="button"
            class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving"
            data-test-id="save-and-leave-confirm"
            @click="saveAndLeave"
          >
            {{ saving ? '保存中…' : 'ダッシュボードに追加して戻る' }}
          </button>
          <button
            type="button"
            class="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm text-surface transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving"
            data-test-id="save-and-leave-discard"
            @click="discardAndLeave"
          >
            破棄して戻る
          </button>
          <button
            type="button"
            class="w-full rounded-lg px-4 py-2.5 text-sm text-muted transition-colors hover:text-surface disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving"
            data-test-id="save-and-leave-cancel"
            @click="cancel"
          >
            キャンセル
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
