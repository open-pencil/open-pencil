<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, normalizeClass, type HTMLAttributes } from 'vue'

import type { DocumentKind } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue/i18n'

import { DOCUMENT_KIND_ICONS } from '@/components/home/document/kinds'
import { useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import iconButtonTheme from '@/theme/button/icon-button'
import documentEntryTheme from '@/theme/home/document-entry'

const documentEntry = tv(documentEntryTheme)
const iconButton = tv(iconButtonTheme)

const {
  name,
  kind,
  metadata,
  previewURL,
  view = 'grid',
  disabled = false,
  menu,
  class: className
} = defineProps<{
  name: string
  /** A design or a board, marked before the name as Figma marks its files; unknown leaves no mark. */
  kind?: DocumentKind
  metadata: string
  previewURL?: string | null
  view?: 'grid' | 'list'
  disabled?: boolean
  /** Labels of the entry's menu, opened from its ⋯ button or by right-clicking; none without them. */
  menu?: { actions: string; delete: string }
  class?: HTMLAttributes['class']
}>()
const emit = defineEmits<{ open: []; delete: [] }>()
const styles = computed(() => documentEntry({ view, kind }))
const { files } = useI18n()
const kindLabel = computed(() =>
  kind ? { design: files.value.createDesign, board: files.value.createBoard }[kind] : null
)
const menuUI = useMenuUI({ content: 'min-w-40', item: 'justify-start gap-2 text-error' })
</script>

<template>
  <!--
    The entry's own element is its root, so a parent's directives and attributes reach it, as the
    preview directives of Home do; under the context menu they would land on a fragment.
  -->
  <div
    data-slot="document-entry"
    :data-kind="kind"
    :class="styles.root({ class: normalizeClass(className) })"
  >
    <ContextMenuRoot :disabled="!menu">
      <ContextMenuTrigger as="div" data-slot="surface" :class="styles.surface()">
        <button
          type="button"
          :disabled="disabled"
          data-slot="trigger"
          :class="styles.trigger()"
          @click="emit('open')"
        >
          <span v-if="view === 'grid'" data-slot="preview" :class="styles.preview()">
            <img v-if="previewURL" :src="previewURL" alt="" :class="styles.image()" />
            <icon-lucide-file-image v-else :class="styles.fallback()" />
          </span>
          <component
            :is="DOCUMENT_KIND_ICONS[kind]"
            v-else-if="kind"
            :class="styles.icon()"
            aria-hidden="true"
          />
          <icon-lucide-file-image v-else :class="styles.icon()" />
          <span data-slot="body" :class="styles.body()">
            <span data-slot="title" :class="styles.title()">
              <component
                :is="DOCUMENT_KIND_ICONS[kind]"
                v-if="kind && view === 'grid'"
                :class="styles.kind()"
                aria-hidden="true"
              />
              <span v-if="kindLabel" class="sr-only">{{ kindLabel }},</span>
              <span data-slot="name" :class="styles.name()">{{ name }}</span>
              <span v-if="$slots.status" data-slot="status" :class="styles.status()">
                <slot name="status" />
              </span>
            </span>
            <span data-slot="metadata" :class="styles.metadata()">{{ metadata }}</span>
          </span>
          <span v-if="view === 'list'" :class="styles.trailingMetadata()">{{ metadata }}</span>
        </button>
        <div v-if="$slots.actions" data-slot="actions" :class="styles.actions()">
          <slot name="actions" />
        </div>
        <DropdownMenuRoot v-if="menu">
          <DropdownMenuTrigger
            :aria-label="menu.actions"
            data-test-id="home-document-actions"
            :class="iconButton({ size: 'xs', class: styles.menuTrigger() })"
          >
            <icon-lucide-ellipsis class="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent align="end" :side-offset="4" :class="menuUI.content">
              <MenuScrollArea>
                <DropdownMenuItem
                  :class="menuUI.item"
                  data-test-id="home-document-delete"
                  @select="emit('delete')"
                >
                  <icon-lucide-trash-2 :class="menuUI.icon" />
                  {{ menu.delete }}
                </DropdownMenuItem>
              </MenuScrollArea>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </ContextMenuTrigger>
      <ContextMenuPortal v-if="menu">
        <ContextMenuContent :class="menuUI.content">
          <MenuScrollArea>
            <ContextMenuItem :class="menuUI.item" @select="emit('delete')">
              <icon-lucide-trash-2 :class="menuUI.icon" />
              {{ menu.delete }}
            </ContextMenuItem>
          </MenuScrollArea>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenuRoot>
  </div>
</template>
