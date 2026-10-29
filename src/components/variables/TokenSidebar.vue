<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { useI18n } from '@open-pencil/vue/i18n'

import type { GroupEntry } from '@/app/editor/tokens/model'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import sidebarTheme from '@/theme/variables/sidebar'

/**
 * Collections and the groups inside the active one, each with how many tokens it holds. Picking
 * a group narrows the list to it and the groups inside it.
 */
const { collections, groups, total } = defineProps<{
  /** `library` marks a collection copied from a library. */
  collections: Array<{ id: string; name: string; count: number; library: boolean }>
  groups: GroupEntry[]
  /** Tokens in the active collection, shown beside "All". */
  total: number
}>()
const activeCollectionId = defineModel<string>('collectionId', { required: true })
/** The group the list is narrowed to, or null for every token in the collection. */
const activeGroup = defineModel<string | null>('group', { default: null })
const emit = defineEmits<{ addCollection: [] }>()

const { variables } = useI18n()
const ui = tv(sidebarTheme)()
</script>

<template>
  <nav :class="ui.root()" :aria-label="variables.collections" data-test-id="tokens-sidebar">
    <section :class="ui.section()">
      <div :class="ui.heading()">
        <h3 :class="ui.title()">{{ variables.collections }}</h3>
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
        :class="ui.item()"
        :data-active="item.id === activeCollectionId || undefined"
        :aria-current="item.id === activeCollectionId ? 'true' : undefined"
        data-test-id="variables-collection-tab"
        @click="activeCollectionId = item.id"
      >
        <span class="truncate">{{ item.name }}</span>
        <Tip v-if="item.library" :label="variables.libraryCollectionHint">
          <AppBadge>{{ variables.libraryCollection }}</AppBadge>
        </Tip>
        <span :class="ui.count()">{{ item.count }}</span>
      </button>
    </section>

    <section v-if="groups.length > 0" :class="ui.section()">
      <h3 :class="[ui.title(), ui.heading()]">{{ variables.groups }}</h3>
      <button
        type="button"
        :class="ui.item()"
        :data-active="activeGroup === null || undefined"
        :aria-current="activeGroup === null ? 'true' : undefined"
        @click="activeGroup = null"
      >
        <span class="truncate">{{ variables.allVariables }}</span>
        <span :class="ui.count()">{{ total }}</span>
      </button>
      <button
        v-for="group in groups"
        :key="group.path"
        type="button"
        :class="ui.item()"
        :style="{ '--depth': group.depth }"
        :data-active="activeGroup === group.path || undefined"
        :aria-current="activeGroup === group.path ? 'true' : undefined"
        data-test-id="variables-group"
        @click="activeGroup = group.path"
      >
        <span :class="ui.groupLabel()">{{ group.label }}</span>
        <span :class="ui.count()">{{ group.count }}</span>
      </button>
    </section>
  </nav>
</template>
