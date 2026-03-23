<script setup lang="ts">
import { computed } from 'vue'

import { usePageList } from '../PageList/usePageList'

const props = defineProps<{
  dividerPattern?: RegExp
}>()

const emit = defineEmits<{
  add: []
  switch: [pageId: string]
  rename: [pageId: string, name: string]
  delete: [pageId: string]
}>()

const { pages, currentPageId, switchPage, addPage, renamePage, deletePage } = usePageList()

const dividerPattern = computed(() => props.dividerPattern ?? /^[-–—*\s]+$/)

function isDivider(page: { name: string; childIds: string[] }) {
  return page.childIds.length === 0 && dividerPattern.value.test(page.name)
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
</script>

<template>
  <slot
    :pages="pages"
    :current-page-id="currentPageId"
    :is-divider="isDivider"
    :add-page="handleAdd"
    :switch-page="handleSwitch"
    :rename-page="handleRename"
    :delete-page="handleDelete"
  />
</template>
