<script setup lang="ts">
import { useFocus } from '@vueuse/core'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, nextTick, ref, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import Tip from '@/components/ui/overlay/Tip.vue'
import iconButtonTheme from '@/theme/button/icon-button'
import { chatHistoryTheme } from '@/theme/chat/history'

const {
  conversations,
  selectedId,
  disabled = false,
  saved = false,
  debug = false,
  acpDebug = false
} = defineProps<{
  conversations: { id: string; title: string; documentName: string; available: boolean }[]
  selectedId?: string
  disabled?: boolean
  saved?: boolean
  debug?: boolean
  acpDebug?: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  create: []
  rename: [id: string, title: string]
  delete: [id: string]
  copyDebug: []
  copyACPDebug: []
}>()
const { ai } = useI18n()
const triggerClass = tv(iconButtonTheme)({ size: 'sm' })
const styles = chatHistoryTheme()
const menu = useMenuUI({ content: 'min-w-44' })
const item = menuItem({ justify: 'start' })
const open = ref(false)
const all = ref(false)
const query = ref('')
const editing = ref(false)
const confirming = ref(false)
const title = ref('')
const titleInput = ref<HTMLInputElement>()
const { focused } = useFocus(titleInput)
const selected = computed(() => conversations.find((chat) => chat.id === selectedId))
const results = computed(() =>
  conversations.filter(
    (chat) =>
      (all.value || chat.available) &&
      `${chat.title} ${chat.documentName}`
        .toLocaleLowerCase()
        .includes(query.value.trim().toLocaleLowerCase())
  )
)
watch(
  () => selectedId,
  () => {
    editing.value = false
    confirming.value = false
  }
)
function choose(id: string) {
  open.value = false
  emit('select', id)
}
async function rename() {
  confirming.value = false
  title.value = selected.value?.title ?? ''
  editing.value = true
  await nextTick()
  focused.value = true
  titleInput.value?.select()
}
function confirmDelete() {
  editing.value = false
  confirming.value = true
}
function remove() {
  if (selectedId) emit('delete', selectedId)
  confirming.value = false
}
function save() {
  if (selectedId && title.value.trim()) emit('rename', selectedId, title.value)
  editing.value = false
}
function closeMenu(event: Event) {
  if (editing.value) event.preventDefault()
}
</script>

<template>
  <div :class="styles.root()">
    <div :class="styles.header()">
      <PopoverRoot v-model:open="open">
        <PopoverTrigger :class="styles.trigger()" :disabled="disabled" :aria-label="ai.chatHistory">
          <span :class="styles.title()">{{ selected?.title || ai.newChat }}</span>
          <icon-lucide-chevron-down :class="styles.icon()" />
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            align="start"
            :side-offset="6"
            :class="styles.content()"
            :aria-label="ai.chatHistory"
          >
            <input
              v-model="query"
              :aria-label="ai.searchChats"
              :placeholder="ai.searchChats"
              :class="styles.input()"
            />
            <div :class="styles.scope()" role="group" :aria-label="ai.chatScope">
              <button
                :class="styles.scopeButton()"
                :data-active="!all"
                :aria-pressed="!all"
                @click="all = false"
              >
                {{ ai.thisDocument }}
              </button>
              <button
                :class="styles.scopeButton()"
                :data-active="all"
                :aria-pressed="all"
                @click="all = true"
              >
                {{ ai.allDocuments }}
              </button>
            </div>
            <div :class="styles.list()">
              <button
                v-for="chat in results"
                :key="chat.id"
                :class="styles.row()"
                :data-selected="chat.id === selectedId"
                :aria-current="chat.id === selectedId ? 'true' : undefined"
                :disabled="disabled"
                @click="choose(chat.id)"
              >
                <span :class="styles.title()"
                  ><span :class="styles.label()">{{ chat.title || ai.newChat }}</span
                  ><span v-if="all" :class="styles.detail()">{{ chat.documentName }}</span></span
                >
                <icon-lucide-check v-if="chat.id === selectedId" :class="styles.icon()" />
              </button>
              <p v-if="!results.length" :class="styles.empty()">{{ ai.noChatsFound }}</p>
            </div>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
      <IconButton :label="ai.newChat" :disabled="disabled" size="sm" @click="emit('create')"
        ><icon-lucide-plus :class="styles.icon()"
      /></IconButton>
      <DropdownMenuRoot v-if="saved">
        <Tip :label="ai.chatActions">
          <DropdownMenuTrigger
            :class="triggerClass"
            :aria-label="ai.chatActions"
            :disabled="disabled"
          >
            <icon-lucide-ellipsis :class="styles.icon()" />
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuPortal>
          <DropdownMenuContent
            align="end"
            :side-offset="6"
            :class="menu.content"
            @close-auto-focus="closeMenu"
          >
            <DropdownMenuItem :class="item" @select="rename">{{ ai.renameChat }}</DropdownMenuItem>
            <DropdownMenuItem :class="item" @select="confirmDelete">{{
              ai.deleteChat
            }}</DropdownMenuItem>
            <DropdownMenuSeparator v-if="debug" class="my-1 border-t border-border" />
            <DropdownMenuItem v-if="debug" :class="item" @select="emit('copyDebug')">{{
              ai.copyDiagnosticLog
            }}</DropdownMenuItem>
            <DropdownMenuItem v-if="acpDebug" :class="item" @select="emit('copyACPDebug')">{{
              ai.copyACPLog
            }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
    <form
      v-if="editing"
      :class="styles.form()"
      @submit.prevent="save"
      @keydown.esc.stop="editing = false"
    >
      <input ref="titleInput" v-model="title" :aria-label="ai.chatTitle" :class="styles.input()" />
      <div :class="styles.actions()">
        <AppButton size="xs" @click="editing = false">{{ ai.cancelChatAction }}</AppButton
        ><AppButton size="xs" type="submit" :disabled="disabled || !title.trim()">{{
          ai.saveChatTitle
        }}</AppButton>
      </div>
    </form>
    <div v-if="confirming" :class="styles.form()" @keydown.esc.stop="confirming = false">
      <p :class="styles.confirmation()">{{ ai.deleteChatConfirmation }}</p>
      <div :class="styles.actions()">
        <AppButton size="xs" @click="confirming = false">{{ ai.cancelChatAction }}</AppButton
        ><AppButton size="xs" color="error" :disabled="disabled" @click="remove">{{
          ai.deleteChat
        }}</AppButton>
      </div>
    </div>
  </div>
</template>
