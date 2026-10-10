<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { commentThreadNumbers, listCommentThreads } from '@open-pencil/scene-graph'
import { useCommentMessages } from '@open-pencil/vue'

import { useComments } from '@/app/comments/use'
import { useEditorStore } from '@/app/editor/active-store'
import ZoomDropdown from '@/components/editor/ZoomDropdown.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import PanelHeader from '@/components/ui/panel/PanelHeader.vue'
import { comments as commentsTheme } from '@/theme/comments'

import CommentActionsMenu from './CommentActionsMenu.vue'
import CommentListItem from './CommentListItem.vue'

/** The comments list that takes over the right sidebar while the Comment tool is active. */
const store = useEditorStore()
const comments = useComments()
const messages = useCommentMessages()
const menuCls = useMenuUI({ content: 'min-w-52' })
const itemCls = menuItem({ justify: 'start', class: 'relative pl-7' })
const ui = commentsTheme()
const { listQuery, listShowResolved, listOnlyPage, listSort, listOnlyMine } = comments

const numbers = computed(() => commentThreadNumbers(comments.threads.value))
const listed = computed(() =>
  listCommentThreads(comments.threads.value, {
    query: listQuery.value,
    showResolved: listShowResolved.value,
    onlyPage: listOnlyPage.value,
    pageId: store.state.currentPageId,
    onlyMine: listOnlyMine.value,
    author: comments.author.value,
    sort: listSort.value
  })
)

const filtered = computed(
  () => listQuery.value.trim() !== '' || listOnlyMine.value || listOnlyPage.value
)

function pageName(pageId: string, fallback?: string) {
  return store.graph.getNode(pageId)?.name ?? fallback ?? ''
}

function setSort(value: unknown) {
  if (value === 'newest' || value === 'oldest') listSort.value = value
}
</script>

<template>
  <section :class="ui.panel()" :aria-label="messages.comments" data-slot="comments-panel">
    <PanelHeader>
      <template #icon><icon-lucide-messages-square class="size-3.5" /></template>
      {{ messages.comments }}
      <template #actions>
        <ZoomDropdown />
        <DropdownMenuRoot :modal="false">
          <DropdownMenuTrigger as-child>
            <IconButton :label="messages.filterAndSort" :active="filtered">
              <icon-lucide-list-filter class="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent :class="menuCls.content" align="end" :side-offset="4">
              <DropdownMenuRadioGroup :model-value="listSort" @update:model-value="setSort">
                <DropdownMenuRadioItem value="newest" :class="itemCls">
                  <DropdownMenuItemIndicator :class="ui.menuIndicator()">
                    <icon-lucide-check class="size-3.5" />
                  </DropdownMenuItemIndicator>
                  {{ messages.newestFirst }}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest" :class="itemCls">
                  <DropdownMenuItemIndicator :class="ui.menuIndicator()">
                    <icon-lucide-check class="size-3.5" />
                  </DropdownMenuItemIndicator>
                  {{ messages.oldestFirst }}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator :class="menuCls.separator" />
              <DropdownMenuCheckboxItem v-model="listShowResolved" :class="itemCls">
                <DropdownMenuItemIndicator :class="ui.menuIndicator()">
                  <icon-lucide-check class="size-3.5" />
                </DropdownMenuItemIndicator>
                {{ messages.showResolved }}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem v-model="listOnlyMine" :class="itemCls">
                <DropdownMenuItemIndicator :class="ui.menuIndicator()">
                  <icon-lucide-check class="size-3.5" />
                </DropdownMenuItemIndicator>
                {{ messages.onlyMine }}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem v-model="listOnlyPage" :class="itemCls">
                <DropdownMenuItemIndicator :class="ui.menuIndicator()">
                  <icon-lucide-check class="size-3.5" />
                </DropdownMenuItemIndicator>
                {{ messages.onlyPage }}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </template>
    </PanelHeader>

    <div :class="ui.panelSearch()">
      <AppInput
        v-model="listQuery"
        type="search"
        size="sm"
        :aria-label="messages.searchComments"
        :placeholder="messages.searchComments"
      >
        <template #leading><icon-lucide-search class="size-3.5" /></template>
      </AppInput>
    </div>

    <AppPlaceholder
      v-if="listed.length === 0"
      size="compact"
      :label="filtered ? messages.noMatches : messages.empty"
    />
    <ul v-else :class="ui.list()" :aria-label="messages.comments">
      <ContextMenuRoot v-for="thread in listed" :key="thread.id" :modal="false">
        <ContextMenuTrigger as-child>
          <CommentListItem
            :thread="thread"
            :number="numbers.get(thread.id) ?? 0"
            :page-name="pageName(thread.pageId, thread.pageName)"
            :active="comments.activeThreadId.value === thread.id"
            @select="comments.focusThread(thread.id)"
          >
            <template #actions>
              <DropdownMenuRoot :modal="false">
                <DropdownMenuTrigger as-child>
                  <IconButton :label="messages.moreActions">
                    <icon-lucide-ellipsis class="size-3.5" />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent :class="menuCls.content" align="end" :side-offset="4">
                    <CommentActionsMenu :thread="thread" kind="dropdown" show-go-to />
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
              <IconButton
                :label="thread.resolved ? messages.reopen : messages.resolve"
                :active="thread.resolved"
                data-command="comment-resolve"
                @click="comments.setResolved(thread.id, !thread.resolved)"
              >
                <icon-lucide-circle-check-big v-if="thread.resolved" class="size-3.5" />
                <icon-lucide-circle-check v-else class="size-3.5" />
              </IconButton>
            </template>
          </CommentListItem>
        </ContextMenuTrigger>
        <ContextMenuPortal>
          <ContextMenuContent :class="menuCls.content">
            <CommentActionsMenu :thread="thread" kind="context" show-go-to />
          </ContextMenuContent>
        </ContextMenuPortal>
      </ContextMenuRoot>
    </ul>
  </section>
</template>
