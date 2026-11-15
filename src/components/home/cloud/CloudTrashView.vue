<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { useCloudMessages, useCommonMessages, useI18n } from '@open-pencil/vue/i18n'

import { DOCUMENT_KIND_ICONS } from '@/components/document/kinds'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import trashTheme from '@/theme/home/trash'

import type { CloudTrashRow } from './types'

/**
 * Trash on the home tab: documents deleted from the person's workspaces on a Cloud server, each
 * with where and when it went and how long it stays, to restore or, where the person may, delete
 * for good.
 */
const {
  documents,
  state = 'ready',
  busy = null
} = defineProps<{
  documents: CloudTrashRow[]
  state?: 'loading' | 'ready' | 'error'
  /** The document an action is running on; its buttons wait and the others stay usable. */
  busy?: string | null
}>()

const emit = defineEmits<{
  restore: [document: CloudTrashRow]
  purge: [document: CloudTrashRow]
  refresh: []
}>()

const trash = tv(trashTheme)
const ui = trash()
const t = useCloudMessages()
const common = useCommonMessages()
const { files } = useI18n()
</script>

<template>
  <section :class="ui.root()" data-test-id="home-trash">
    <header :class="ui.header()">
      <div :class="ui.heading()">
        <h1 :class="ui.title()">{{ t.homeTrash }}</h1>
        <p :class="ui.subtitle()">{{ t.homeTrashSubtitle }}</p>
      </div>
      <IconButton :label="common.refresh" class="size-7" @click="emit('refresh')">
        <icon-lucide-refresh-cw class="size-3.5" />
      </IconButton>
    </header>

    <AppAlert v-if="state === 'error'" tone="error" :heading="t.homeTrashLoadFailed">
      <template #actions>
        <AppButton size="sm" variant="outline" @click="emit('refresh')">{{ t.tryAgain }}</AppButton>
      </template>
    </AppAlert>

    <div v-if="state === 'loading'" :class="ui.list()" :aria-label="t.homeLoadingFiles">
      <div v-for="index in 3" :key="index" :class="ui.skeleton()" />
    </div>

    <AppPlaceholder
      v-else-if="documents.length === 0 && state === 'ready'"
      size="page"
      label-as="h2"
      :label="t.homeTrashEmpty"
      :description="t.homeTrashEmptyDescription"
      :ui="{ root: 'rounded-lg border border-dashed border-border py-10' }"
    >
      <template #icon><icon-lucide-trash-2 class="size-5" /></template>
    </AppPlaceholder>

    <ul v-else-if="documents.length > 0" :class="ui.list()">
      <li
        v-for="document in documents"
        :key="document.id"
        :class="ui.row()"
        data-test-id="home-trash-row"
      >
        <component
          :is="DOCUMENT_KIND_ICONS[document.kind]"
          v-if="document.kind"
          :class="trash({ kind: document.kind }).icon()"
          aria-hidden="true"
        />
        <icon-lucide-file-image v-else :class="ui.icon()" />
        <span :class="ui.body()">
          <span :class="ui.name()">
            <span v-if="document.kind" class="sr-only">
              {{ document.kind === 'board' ? files.createBoard : files.createDesign }},
            </span>
            {{ document.name }}
          </span>
          <span :class="ui.metadata()">{{ document.metadata }}</span>
        </span>
        <span :class="ui.left()">{{ t.homeTrashDaysLeft(document.daysLeft) }}</span>
        <span :class="ui.actions()">
          <AppButton
            size="sm"
            variant="outline"
            :loading="busy === document.id"
            :disabled="busy === document.id"
            @click="emit('restore', document)"
          >
            {{ t.homeTrashRestore }}
          </AppButton>
          <IconButton
            v-if="document.canPurge"
            :label="t.homeTrashDeleteForever"
            :disabled="busy === document.id"
            class="size-7 text-error"
            @click="emit('purge', document)"
          >
            <icon-lucide-trash-2 class="size-3.5" />
          </IconButton>
        </span>
      </li>
    </ul>
  </section>
</template>
