<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { colorToCSS } from '@open-pencil/scene-graph/color'
import { useI18n } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import FillSwatch from '@/components/ui/paint/FillSwatch.vue'
import AppPicker, { type AppPickerItem } from '@/components/ui/select/AppPicker.vue'

import BindingTrigger from './BindingTrigger.vue'
import type { VariablePickerItem, VariablePickerProps } from './picker'
import { useBindingFieldUI } from './ui'

/**
 * Picks the variable a value points at: the Properties panel binds a layer's field with it and
 * the Variables dialog aliases a mode's value, so both look and work the same.
 */
const {
  items,
  recent = [],
  selected,
  state,
  triggerLabel,
  searchPlaceholder,
  emptyLabel,
  detachLabel,
  closeLabel,
  createLabel,
  createNamePlaceholder = 'Variable name',
  createSubmitLabel = 'Create',
  createDefaultName = '',
  disabled = false,
  derived = false,
  side,
  ui
} = defineProps<VariablePickerProps>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  select: [id: string]
  detach: []
  create: [name: string]
  closeAutoFocus: [event: Event]
}>()

const { common, variables } = useI18n()
const creating = ref(false)
const createName = ref('')
const createInput = ref<HTMLInputElement | null>(null)
const canCreate = computed(() => createName.value.trim().length > 0)
const styles = computed(() => useBindingFieldUI({ state, open: open.value, disabled, derived }, ui))
/** Hovering the variable button of a bound value names its variable. */
const triggerTooltip = computed(() => {
  const bound = state === 'bound' ? items.find((item) => item.id === selected) : undefined
  return bound?.name ?? triggerLabel
})
/** A recent variable's row, listed apart from the same variable in its group. */
const RECENT_PREFIX = 'recent:'

function recentItems(): AppPickerItem[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  return recent.flatMap((id) => {
    const item = byId.get(id)
    if (!item) return []
    const row = { value: `${RECENT_PREFIX}${id}`, label: item.name, group: item.collection }
    return [{ ...row, folder: variables.value.recentVariables }]
  })
}

/** Recent variables, then each variable where its name's path puts it. */
const pickerItems = computed<AppPickerItem[]>(() => {
  const sections = sectionsOf(items)
  return [...recentItems(), ...items.map((item) => groupedItem(item, sections))]
})

/** The headings a collection's longer paths make: `color` for `color/red/500`. */
function sectionsOf(entries: readonly VariablePickerItem[]): Set<string> {
  const deep = entries.filter((item) => item.name.split('/').length > 2)
  return new Set(deep.map((item) => sectionKey(item.collection, item.name.split('/').slice(0, -2))))
}

function sectionKey(collection: string | undefined, path: readonly string[]): string {
  return `${collection ?? ''}\u0000${path.join(' / ')}`
}

/**
 * A name with a path lists its last part in a folder of the part before: `spacing/4` as `4` in
 * `spacing`, and `color/red/500` as `500` in `red`, under the heading `color`. A name such as
 * `color/white`, whose first part is already a heading, sits under it before its folders.
 */
function groupedItem(item: VariablePickerItem, sections: ReadonlySet<string>): AppPickerItem {
  const path = item.name.split('/')
  const row = { value: item.id, label: path.at(-1) ?? item.name, group: item.collection }
  if (path.length < 2) return { ...row, label: item.name }
  const parent = path.slice(0, -1)
  if (sections.has(sectionKey(item.collection, parent))) {
    return { ...row, accessibleName: item.name, section: parent.join(' / ') }
  }
  const section = path.length > 2 ? path.slice(0, -2).join(' / ') : undefined
  return { ...row, accessibleName: item.name, section, folder: path.at(-2) }
}

function variableId(value: string): string {
  return value.startsWith(RECENT_PREFIX) ? value.slice(RECENT_PREFIX.length) : value
}

function itemOf(value: string) {
  const id = variableId(value)
  return items.find((item) => item.id === id)
}

function color(value: string) {
  return itemOf(value)?.color
}

/** The colors of a folder's variables, for the strip beside its name. */
function folderColors(entries: readonly AppPickerItem[]) {
  return entries.flatMap((entry) => {
    const value = color(entry.value)
    return value ? [value] : []
  })
}

function startCreate() {
  creating.value = true
  createName.value = createDefaultName
  void nextTick(() => {
    createInput.value?.focus()
    createInput.value?.select()
  })
}

function submitCreate() {
  const name = createName.value.trim()
  if (name) emit('create', name)
}

function detach() {
  emit('detach')
  open.value = false
}

watch(open, (isOpen) => {
  if (!isOpen) creating.value = false
})

defineOptions({ inheritAttrs: false })
</script>

<template>
  <span class="inline-flex shrink-0 items-center" data-slot="anchor">
    <AppPicker
      v-model:open="open"
      :heading="triggerLabel"
      :items="pickerItems"
      :selected="selected"
      :open-folders="[variables.recentVariables]"
      density="compact"
      :search-placeholder="searchPlaceholder"
      :empty-label="emptyLabel"
      :close-label="closeLabel ?? common.close"
      :tooltip="triggerTooltip"
      :side="side"
      @select="emit('select', variableId($event))"
      @close-auto-focus="emit('closeAutoFocus', $event)"
    >
      <template #trigger>
        <BindingTrigger
          v-bind="$attrs"
          :label="triggerLabel"
          :state="state"
          :open="open"
          :disabled="disabled"
          :derived="derived"
          :ui="ui"
        />
      </template>
      <template #leading="{ item }">
        <FillSwatch
          v-if="color(item.value)"
          :fill="{
            type: 'SOLID',
            visible: true,
            opacity: color(item.value)?.a ?? 1,
            color: color(item.value) ?? { r: 0, g: 0, b: 0, a: 1 }
          }"
          :ui="{ root: 'size-3.5 shrink-0 rounded-sm' }"
        />
        <icon-lucide-diamond v-else class="size-3.5 text-muted" />
      </template>
      <template #trailing="{ item }">
        <span v-if="itemOf(item.value)?.text" class="shrink-0 text-muted tabular-nums">
          {{ itemOf(item.value)?.text }}
        </span>
      </template>
      <template #folder="{ items: entries }">
        <span
          v-if="folderColors(entries).length > 0"
          class="flex shrink-0 gap-px"
          aria-hidden="true"
        >
          <span
            v-for="(swatch, index) in folderColors(entries).slice(0, 11)"
            :key="index"
            class="size-2.5 first:rounded-s-sm last:rounded-e-sm"
            :style="{ backgroundColor: colorToCSS(swatch) }"
          />
        </span>
        <span v-else class="shrink-0 text-3xs text-muted tabular-nums">{{ entries.length }}</span>
      </template>
      <template v-if="state !== 'unbound' || creating || createLabel" #footer>
        <AppButton
          v-if="state !== 'unbound'"
          size="xs"
          class="w-full justify-start"
          @click="detach"
        >
          <template #leading><icon-lucide-unlink class="size-3" /></template>
          {{ detachLabel }}
        </AppButton>
        <form
          v-if="creating"
          :class="styles.createForm"
          data-slot="createForm"
          @submit.prevent="submitCreate"
          @keydown.esc.prevent.stop="creating = false"
        >
          <input
            ref="createInput"
            v-model="createName"
            :placeholder="createNamePlaceholder"
            :class="styles.createInput"
            data-slot="createInput"
          />
          <AppButton size="xs" variant="soft" :disabled="!canCreate" type="submit">
            {{ createSubmitLabel }}
          </AppButton>
        </form>
        <AppButton
          v-else-if="createLabel"
          size="xs"
          class="w-full justify-start"
          @click="startCreate"
        >
          <template #leading><icon-lucide-plus class="size-3" /></template>
          <span class="min-w-0 flex-1 truncate text-start">{{ createLabel }}</span>
        </AppButton>
      </template>
    </AppPicker>
  </span>
</template>
