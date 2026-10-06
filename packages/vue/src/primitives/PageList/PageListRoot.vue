<script setup lang="ts">
import { computed } from 'vue'

import { isPageDivider, PAGE_DIVIDER_PATTERN } from '#vue/primitives/PageList/divider'
import { usePageList } from '#vue/primitives/PageList/usePageList'

const { dividerPattern: customDividerPattern } = defineProps<{
  dividerPattern?: RegExp
}>()

const emit = defineEmits<{
  add: []
  switch: [pageId: string]
  rename: [pageId: string, name: string]
  delete: [pageId: string]
  move: [pageId: string, index: number]
}>()

const { pages, currentPageId, switchPage, addPage, renamePage, deletePage, movePage } =
  usePageList()

const dividerPattern = computed(() => customDividerPattern ?? PAGE_DIVIDER_PATTERN)

function isDivider(page: { name: string; childIds: string[] }) {
  return isPageDivider(page, dividerPattern.value)
}

function handleAdd() {
  addPage()
  emit('add')
}

function handleSwitch(pageId: string) {
  switchPage(pageId)
  emit('switch', pageId)
}

function handleRename(pageId: string, name: string) {
  renamePage(pageId, name)
  emit('rename', pageId, name)
}

function handleDelete(pageId: string) {
  deletePage(pageId)
  emit('delete', pageId)
}

function handleMove(pageId: string, index: number) {
  movePage(pageId, index)
  emit('move', pageId, index)
}

const actions = {
  add: handleAdd,
  switch: handleSwitch,
  rename: handleRename,
  delete: handleDelete,
  move: handleMove
}
</script>

<template>
  <slot
    :pages="pages"
    :current-page-id="currentPageId"
    :is-divider="isDivider"
    :actions="actions"
  />
</template>
