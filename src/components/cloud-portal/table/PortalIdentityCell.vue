<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AccountAvatar from '@/components/presence/AccountAvatar.vue'

import { portalTable } from './ui'

/**
 * Who a row is about: their picture, name, and a line under it such as their email. With `link`
 * the name opens their page.
 */
const {
  id,
  name,
  detail,
  image = null,
  you = false,
  size = 'md',
  link = false
} = defineProps<{
  id: string
  name: string
  detail?: string | null
  image?: string | null
  /** Marks the signed-in person's own row. */
  you?: boolean
  size?: 'sm' | 'md'
  link?: boolean
}>()
const emit = defineEmits<{ open: [] }>()
const ui = portalTable()
const messages = useCloudPortalMessages()
</script>

<template>
  <div class="flex min-w-0 items-center gap-3">
    <AccountAvatar :id="id" :name="name" :image="image" :size="size" />
    <component
      :is="link ? 'button' : 'div'"
      :type="link ? 'button' : undefined"
      class="min-w-0 rounded text-left focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
      @click="link && emit('open')"
    >
      <span :class="ui.title()">
        <span class="truncate">{{ name }}</span>
        <span v-if="you" class="shrink-0 font-normal text-muted">{{ messages.you }}</span>
      </span>
      <span v-if="detail" :class="[ui.detail(), 'block']">{{ detail }}</span>
    </component>
  </div>
</template>
