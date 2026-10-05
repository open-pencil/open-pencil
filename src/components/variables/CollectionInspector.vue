<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, reactive, watch } from 'vue'

import type { VariableCollection } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import { modeConditionPlaceholder } from '@/app/editor/tokens/model'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import tokensPanelTheme from '@/theme/tokens-panel'

const { collection, layout = 'side' } = defineProps<{
  collection: VariableCollection
  /** `full` fills the panel behind a back button on narrow screens. */
  layout?: 'side' | 'full'
}>()
const emit = defineEmits<{
  rename: [name: string]
  remove: []
  addMode: []
  renameMode: [modeId: string, name: string]
  duplicateMode: [modeId: string]
  setDefaultMode: [modeId: string]
  removeMode: [modeId: string]
  setCondition: [modeId: string, condition: string]
}>()

const { variables } = useI18n()
const ui = computed(() => tv(tokensPanelTheme)({ layout }))
const menu = useMenuUI({ content: 'w-44', item: 'justify-start gap-2' })
const dangerItem = useMenuUI({ item: 'justify-start gap-2 text-error' }).item

/** Text fields edit a draft and commit on change, like the token fields. */
const draft = reactive({
  name: '',
  modeNames: {} as Record<string, string>,
  conditions: {} as Record<string, string>
})
/**
 * Drafts reset when the stored names or conditions change, not whenever the collection is
 * re-read, so a selection change does not discard what is being typed.
 */
watch(
  () =>
    JSON.stringify([
      collection.name,
      collection.modes.map((mode) => [mode.modeId, mode.name, mode.condition ?? ''])
    ]),
  () => {
    draft.name = collection.name
    for (const mode of collection.modes) {
      draft.modeNames[mode.modeId] = mode.name
      draft.conditions[mode.modeId] = mode.condition ?? ''
    }
  },
  { immediate: true }
)

function commitName() {
  const name = draft.name.trim()
  if (name && name !== collection.name) emit('rename', name)
  else draft.name = collection.name
}

function mode(modeId: string) {
  return collection.modes.find((candidate) => candidate.modeId === modeId)
}

function commitModeName(modeId: string) {
  const name = (draft.modeNames[modeId] ?? '').trim()
  const current = mode(modeId)?.name ?? ''
  if (name && name !== current) emit('renameMode', modeId, name)
  else draft.modeNames[modeId] = current
}

function commitCondition(modeId: string) {
  if ((draft.conditions[modeId] ?? '') !== (mode(modeId)?.condition ?? ''))
    emit('setCondition', modeId, draft.conditions[modeId] ?? '')
}
</script>

<template>
  <aside :class="ui.inspector()" data-test-id="collection-inspector">
    <section :class="ui.section()">
      <label :class="ui.field()">
        <span :class="ui.label()">{{ variables.collection }}</span>
        <AppInput
          v-model="draft.name"
          size="sm"
          data-test-id="variables-collection-name"
          @change="commitName"
        />
      </label>
    </section>

    <section :class="ui.section()">
      <div class="flex items-center justify-between">
        <h3 :class="ui.sectionTitle()">{{ variables.modes }}</h3>
        <IconButton
          :label="variables.addMode"
          data-test-id="variables-add-mode"
          @click="emit('addMode')"
        >
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </div>
      <div
        v-for="item in collection.modes"
        :key="item.modeId"
        :class="ui.field()"
        data-test-id="variables-mode"
      >
        <div class="flex items-center gap-1">
          <AppInput
            v-model="draft.modeNames[item.modeId]"
            size="sm"
            class="min-w-0 flex-1"
            :aria-label="variables.renameMode"
            @change="commitModeName(item.modeId)"
          />
          <AppBadge v-if="item.modeId === collection.defaultModeId">
            {{ variables.defaultMode }}
          </AppBadge>
          <DropdownMenuRoot>
            <DropdownMenuTrigger as-child>
              <IconButton :label="variables.modeActions({ mode: item.name })">
                <icon-lucide-ellipsis class="size-3.5" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent side="bottom" :side-offset="4" align="end" :class="menu.content">
                <DropdownMenuItem :class="menu.item" @select="emit('duplicateMode', item.modeId)">
                  <icon-lucide-copy :class="menu.icon" />
                  {{ variables.duplicateMode }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="item.modeId !== collection.defaultModeId"
                  :class="menu.item"
                  @select="emit('setDefaultMode', item.modeId)"
                >
                  <icon-lucide-pin :class="menu.icon" />
                  {{ variables.setDefaultMode }}
                </DropdownMenuItem>
                <DropdownMenuSeparator :class="menu.separator" />
                <DropdownMenuItem
                  :class="dangerItem"
                  :disabled="collection.modes.length <= 1"
                  @select="emit('removeMode', item.modeId)"
                >
                  <icon-lucide-trash-2 :class="menu.icon" />
                  {{ variables.deleteMode }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>
        <span v-if="item.modeId === collection.defaultModeId" :class="ui.cssName()">:root</span>
        <AppInput
          v-else
          v-model="draft.conditions[item.modeId]"
          size="sm"
          :aria-label="`${item.name} ${variables.condition}`"
          :placeholder="modeConditionPlaceholder(collection, item.modeId)"
          :ui="{ input: 'font-mono' }"
          @change="commitCondition(item.modeId)"
        />
      </div>
      <span :class="ui.hint()">{{ variables.conditionHint }}</span>
    </section>

    <section :class="ui.section()">
      <AppButton
        variant="ghost"
        color="error"
        size="sm"
        class="self-start"
        data-test-id="variables-delete-collection"
        @click="emit('remove')"
      >
        <template #leading><icon-lucide-trash-2 class="size-3.5" /></template>
        {{ variables.deleteCollection }}
      </AppButton>
    </section>
  </aside>
</template>
