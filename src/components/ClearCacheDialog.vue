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

import { resolveClearCacheDialog, useClearCacheDialog } from '@/app/shell/menu/clear-cache-dialog'
import { useDialogUI } from '@/components/ui/dialog'

const { open } = useClearCacheDialog()
const cls = useDialogUI({
  content: 'w-96 rounded-lg p-5 shadow-xl'
})

function onCancel() {
  resolveClearCacheDialog(false)
}

function onConfirm() {
  resolveClearCacheDialog(true)
}
</script>

<template>
  <AlertDialogRoot :open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay :class="cls.overlay" @click="onCancel" />
      <AlertDialogContent :class="cls.content" @escape-key-down="onCancel">
        <AlertDialogTitle :class="cls.title">保存されたドキュメントをクリア</AlertDialogTitle>
        <AlertDialogDescription class="mt-2 text-xs leading-relaxed text-muted">
          現在のキャンバスを新規 Untitled ドキュメントに置き換え、ブラウザに自動保存された前回の
          ドキュメントも削除します。この操作は取り消せません。
        </AlertDialogDescription>

        <div class="mt-5 flex justify-end gap-2">
          <AlertDialogCancel
            class="rounded border border-border bg-canvas px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
            @click="onCancel"
          >
            キャンセル
          </AlertDialogCancel>
          <AlertDialogAction
            class="rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
            @click="onConfirm"
          >
            クリア
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
