<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  ContextMenuItem,
  ContextMenuSeparator,
  DropdownMenuItem,
  DropdownMenuSeparator
} from 'reka-ui'
import { computed } from 'vue'

import type { CommentThread } from '@open-pencil/scene-graph'
import { useCommentMessages, useCommonMessages } from '@open-pencil/vue'

import { useComments } from '@/app/comments/use'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import { useActionToast } from '@/app/shell/toast/action'
import AppShortcutText from '@/components/ui/menu/AppShortcutText.vue'
import { useMenuUI } from '@/components/ui/menu/menu'

// One list of comment actions for both the right-click menu and the "More actions" button.
const {
  thread,
  kind,
  showGoTo = false,
  showHide = false
} = defineProps<{
  thread: CommentThread
  kind: 'context' | 'dropdown'
  showGoTo?: boolean
  /** Offer Hide comments, as a pin's menu does in Figma. */
  showHide?: boolean
}>()

const comments = useComments()
const messages = useCommentMessages()
const common = useCommonMessages()
const { copy } = useClipboard({ legacy: true })
const { showActionToast } = useActionToast()
const menuCls = useMenuUI({ item: 'justify-start gap-2' })

const Item = computed(() => (kind === 'context' ? ContextMenuItem : DropdownMenuItem))
const Separator = computed(() =>
  kind === 'context' ? ContextMenuSeparator : DropdownMenuSeparator
)

async function copyText() {
  await copy(thread.text)
  showActionToast(common.value.copied)
}
</script>

<template>
  <component
    :is="Item"
    v-if="showGoTo"
    :class="menuCls.item"
    data-command="comment-go-to"
    @select="comments.focusThread(thread.id)"
  >
    <icon-lucide-locate-fixed :class="menuCls.icon" />
    <span>{{ messages.goToComment }}</span>
  </component>
  <component
    :is="Item"
    :class="menuCls.item"
    data-command="comment-resolve"
    @select="comments.setResolved(thread.id, !thread.resolved)"
  >
    <icon-lucide-rotate-ccw v-if="thread.resolved" :class="menuCls.icon" />
    <icon-lucide-circle-check v-else :class="menuCls.icon" />
    <span>{{ thread.resolved ? messages.reopen : messages.resolve }}</span>
  </component>
  <component :is="Item" :class="menuCls.item" data-command="comment-copy" @select="copyText">
    <icon-lucide-copy :class="menuCls.icon" />
    <span>{{ messages.copyText }}</span>
  </component>
  <component :is="Separator" :class="menuCls.separator" />
  <component
    :is="Item"
    :class="menuCls.item"
    data-command="comment-delete"
    @select="comments.requestDelete(thread.id)"
  >
    <icon-lucide-trash-2 :class="menuCls.icon" />
    <span>{{ messages.delete }}</span>
  </component>
  <template v-if="showHide">
    <component :is="Separator" :class="menuCls.separator" />
    <component
      :is="Item"
      :class="menuCls.item"
      data-command="comments-hide"
      @select="comments.toggleOnCanvas"
    >
      <icon-lucide-eye-off :class="menuCls.icon" />
      <span class="flex-1">{{ messages.hideComments }}</span>
      <AppShortcutText>{{ appMenuShortcutLabel('view-comments') }}</AppShortcutText>
    </component>
  </template>
</template>
