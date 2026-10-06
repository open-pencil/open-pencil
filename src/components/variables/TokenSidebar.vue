<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { useI18n } from '@open-pencil/vue'

import type { GroupEntry } from '@/app/editor/tokens/model'
import IconButton from '@/components/ui/button/IconButton.vue'
import tokensPanelTheme from '@/theme/tokens-panel'

/**
 * Collections and the groups inside the active one, each with how many tokens it holds. Picking
 * a group narrows the list to it and the groups inside it.
 */
const { collections, groups, total } = defineProps<{
  collections: Array<{ id: string; name: string; count: number }>
  groups: GroupEntry[]
  /** Tokens in the active collection, shown beside "All". */
  total: number
}>()
const activeCollectionId = defineModel<string>('collectionId', { required: true })
/** The group the list is narrowed to, or null for every token in the collection. */
const activeGroup = defineModel<string | null>('group', { default: null })
const emit = defineEmits<{ addCollection: [] }>()

const { variables } = useI18n()
const ui = tv(tokensPanelTheme)()
</script>

<template>
  <nav :class="ui.sidebar()" :aria-label="variables.collections" data-test-id="tokens-sidebar">
    <section :class="ui.sidebarSection()">
      <div :class="ui.sidebarHeading()">
        <h3 :class="ui.sectionTitle()">{{ variables.collections }}</h3>
        <IconButton
          :label="variables.createCollection"
          data-test-id="variables-add-collection"
          @click="emit('addCollection')"
        >
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </div>
      <button
        v-for="item in collections"
        :key="item.id"
        type="button"
        :class="ui.sidebarItem()"
        :data-active="item.id === activeCollectionId || undefined"
        :aria-current="item.id === activeCollectionId ? 'true' : undefined"
        data-test-id="variables-collection-tab"
        @click="activeCollectionId = item.id"
      >
        <span class="truncate">{{ item.name }}</span>
        <span :class="ui.sidebarCount()">{{ item.count }}</span>
      </button>
    </section>

    <section v-if="groups.length > 0" :class="ui.sidebarSection()">
      <h3 :class="[ui.sectionTitle(), ui.sidebarHeading()]">{{ variables.groups }}</h3>
      <button
        type="button"
        :class="ui.sidebarItem()"
        :data-active="activeGroup === null || undefined"
        :aria-current="activeGroup === null ? 'true' : undefined"
        @click="activeGroup = null"
      >
        <span class="truncate">{{ variables.allVariables }}</span>
        <span :class="ui.sidebarCount()">{{ total }}</span>
      </button>
      <button
        v-for="group in groups"
        :key="group.path"
        type="button"
        :class="ui.sidebarItem()"
        :style="{ '--depth': group.depth }"
        :data-active="activeGroup === group.path || undefined"
        :aria-current="activeGroup === group.path ? 'true' : undefined"
        data-test-id="variables-group"
        @click="activeGroup = group.path"
      >
        <span :class="ui.sidebarGroupLabel()">{{ group.label }}</span>
        <span :class="ui.sidebarCount()">{{ group.count }}</span>
      </button>
    </section>
  </nav>
</template>
