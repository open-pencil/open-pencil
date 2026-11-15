<script setup lang="ts">
import { useTextareaAutosize } from '@vueuse/core'
import { computed, nextTick, ref, shallowRef, useId, useTemplateRef, watch } from 'vue'

import { useCommentMessages } from '@open-pencil/vue/i18n'
import { fuzzySearch } from '@open-pencil/vue/shared/search'

import {
  commentFormatForKey,
  continueList,
  formatComment,
  type CommentEdit
} from '@/app/comments/format'
import {
  linkMentions,
  mentionQuery,
  shiftMentions,
  type MentionPerson,
  type PickedMention
} from '@/app/comments/mentions/links'
import PersonAvatar from '@/components/presence/PersonAvatar.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { useMenuUI } from '@/components/ui/menu/menu'

import { useCommentAuthor } from './author'
import { comments } from './ui'

/**
 * Where a comment or reply is written. Enter sends and Shift+Enter starts a new line or list
 * item; Figma's shortcuts format the selection as Markdown (`format.ts`). Typing `@` offers the
 * people `mentionable` names, as Figma does; each one picked is sent as a mention of them.
 */
const {
  label,
  bare = false,
  mentionable
} = defineProps<{
  label: string
  /** The composer is its card's whole content, as a new comment's is. */
  bare?: boolean
  /** Whom a comment may name; without it `@` is only a character. */
  mentionable?: () => Promise<readonly MentionPerson[]>
}>()

/** How many people the list offers at once. */
const MENTION_LIMIT = 6

const emit = defineEmits<{ submit: [text: string]; cancel: [] }>()

const text = defineModel<string>({ default: '' })
const input = useTemplateRef<HTMLTextAreaElement>('input')
useTextareaAutosize({ element: input, input: text })

const messages = useCommentMessages()
const ui = computed(() => comments({ bare }))
const menu = useMenuUI()
const who = useCommentAuthor()
const empty = computed(() => text.value.trim() === '')

const listId = useId()
const people = shallowRef<readonly MentionPerson[]>([])
const picked = shallowRef<PickedMention[]>([])
const caret = ref(0)
const highlighted = ref(0)
/** Closed by Escape until the `@` it was offered for is left behind. */
const dismissedAt = ref<number | null>(null)

const query = computed(() => (mentionable ? mentionQuery(text.value, caret.value) : null))
const suggestions = computed(() => {
  const typed = query.value
  if (!typed || typed.start === dismissedAt.value) return []
  const found = typed.query ? fuzzySearch(people.value, ['name'], typed.query) : people.value
  return found.slice(0, MENTION_LIMIT)
})
const optionId = (index: number) => `${listId}-${index}`

// The people load once, when `@` is first typed; a failed load is asked for again at the next `@`.
let loading: Promise<void> | null = null
watch(query, (typed) => {
  if (typed?.start !== dismissedAt.value) dismissedAt.value = null
  highlighted.value = 0
  if (!typed || loading || people.value.length > 0 || !mentionable) return
  loading = loadPeople(mentionable)
})

async function loadPeople(load: () => Promise<readonly MentionPerson[]>) {
  try {
    people.value = await load()
  } catch (error) {
    console.warn('[Comments] Could not load the people to mention', error)
  } finally {
    loading = null
  }
}
// Each mention picked moves with the text around it, and one an edit touched is no longer one.
// It follows every change as it is made, typing, formatting, and clearing after a send alike.
watch(
  text,
  (next, previous) => {
    picked.value = next === '' ? [] : shiftMentions(previous, next, picked.value)
  },
  { flush: 'sync' }
)

function followCaret() {
  caret.value = input.value?.selectionStart ?? text.value.length
}

function pick(person: MentionPerson) {
  const typed = query.value
  if (!typed) return
  const inserted = `@${person.name} `
  const start = typed.start
  text.value = text.value.slice(0, start) + inserted + text.value.slice(caret.value)
  // Added after the text changed, which the watcher has already followed.
  picked.value = [...picked.value, { start, end: start + inserted.length - 1, person }]
  const at = start + inserted.length
  caret.value = at
  void nextTick(() => {
    input.value?.focus()
    input.value?.setSelectionRange(at, at)
  })
}

function submit() {
  if (empty.value) return
  emit('submit', linkMentions(text.value, picked.value).trim())
}

/** Moves through the people offered, picks one, or closes the list; false when it is closed. */
function suggestionKey(event: KeyboardEvent): boolean {
  const count = suggestions.value.length
  if (count === 0) return false
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const step = event.key === 'ArrowDown' ? 1 : -1
    highlighted.value = (highlighted.value + step + count) % count
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    const person = suggestions.value[highlighted.value]
    if (person) pick(person)
  } else if (event.key === 'Escape') {
    dismissedAt.value = query.value?.start ?? null
  } else {
    return false
  }
  event.preventDefault()
  event.stopPropagation()
  return true
}

function apply(next: CommentEdit) {
  text.value = next.value
  void nextTick(() => input.value?.setSelectionRange(next.start, next.end))
}

function onKeydown(event: KeyboardEvent) {
  const element = input.value
  // Enter also confirms a word in an input method; that is not sending.
  if (!element || event.isComposing) return
  if (suggestionKey(event)) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('cancel')
    return
  }
  const current = {
    value: text.value,
    start: element.selectionStart,
    end: element.selectionEnd
  }
  if (event.code === 'Enter' || event.code === 'NumpadEnter') {
    if (event.altKey || event.metaKey || event.ctrlKey) return
    if (!event.shiftKey) {
      event.preventDefault()
      submit()
      return
    }
    const next = continueList(current)
    if (!next) return
    event.preventDefault()
    apply(next)
    return
  }
  const format = commentFormatForKey(event)
  if (!format) return
  // The editor binds some of these keys too, such as Cmd+K for the command palette.
  event.preventDefault()
  event.stopPropagation()
  apply(formatComment(current, format))
}

function focus() {
  input.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <form data-slot="comment-composer" :class="ui.composer()" @submit.prevent="submit">
    <ul
      v-if="suggestions.length > 0"
      :id="listId"
      role="listbox"
      :aria-label="messages.mentionPeople"
      :class="[menu.content, ui.mentions()]"
    >
      <li
        v-for="(person, index) in suggestions"
        :id="optionId(index)"
        :key="person.id"
        role="option"
        :aria-selected="index === highlighted"
        :data-highlighted="index === highlighted || undefined"
        :class="menu.item"
        @mousedown.prevent="pick(person)"
        @mouseenter="highlighted = index"
      >
        <PersonAvatar :name="person.name" :color="who.color(undefined)" size="sm" />
        <span class="truncate">{{ person.name }}</span>
      </li>
    </ul>
    <textarea
      ref="input"
      v-model="text"
      rows="1"
      aria-autocomplete="list"
      :aria-controls="suggestions.length > 0 ? listId : undefined"
      :aria-activedescendant="suggestions.length > 0 ? optionId(highlighted) : undefined"
      :aria-label="label"
      :placeholder="label"
      :class="ui.composerInput()"
      @input="followCaret"
      @click="followCaret"
      @keyup="followCaret"
      @keydown="onKeydown"
    />
    <AppButton
      type="submit"
      color="primary"
      variant="solid"
      shape="pill"
      size="xs"
      :disabled="empty"
      :aria-label="messages.send"
      :ui="{ base: 'size-6 shrink-0 px-0' }"
    >
      <icon-lucide-arrow-up class="size-3.5" />
    </AppButton>
  </form>
</template>
