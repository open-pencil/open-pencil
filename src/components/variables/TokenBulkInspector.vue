<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, onMounted, ref, useId, useTemplateRef, type ComponentPublicInstance } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import inspectorTheme from '@/theme/variables/inspector'

/** Actions for several selected tokens, and naming a new group for the selection. */
const {
  count,
  focusGroup = false,
  layout = 'side'
} = defineProps<{
  count: number
  /** Opened from "New group…", so the group name takes focus. */
  focusGroup?: boolean
  /** `full` fills the panel behind a back button on narrow screens. */
  layout?: 'side' | 'full'
}>()
const emit = defineEmits<{ moveToGroup: [group: string]; duplicate: []; remove: [] }>()

const { variables } = useI18n()
const ui = computed(() => tv(inspectorTheme)({ layout }))
const group = ref('')
const groupId = `${useId()}-group`
const groupInput = useTemplateRef<ComponentPublicInstance>('groupInput')

onMounted(() => {
  if (!focusGroup) return
  const element = groupInput.value?.$el
  const input = element instanceof HTMLElement ? element.querySelector('input') : null
  input?.focus()
})

/** Slashes nest groups, as in token names; empty segments are dropped. */
function move() {
  const path = group.value
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
    .join('/')
  if (path) emit('moveToGroup', path)
}
</script>

<template>
  <aside :class="ui.root()" data-test-id="token-bulk-inspector">
    <section :class="ui.section()">
      <h3 :class="ui.title()">{{ variables.selectedCount({ count }) }}</h3>
    </section>
    <section :class="ui.section()">
      <PanelFieldGroup :label="variables.moveToGroup" :for="groupId">
        <div class="flex items-center gap-1">
          <AppInput
            :id="groupId"
            ref="groupInput"
            v-model="group"
            size="sm"
            class="min-w-0 flex-1"
            :placeholder="variables.groupName"
            data-test-id="variables-group-name"
            @keydown.enter="move"
          />
          <AppButton variant="soft" size="sm" :disabled="!group.trim()" @click="move">
            {{ variables.move }}
          </AppButton>
        </div>
      </PanelFieldGroup>
    </section>
    <section :class="ui.section()">
      <AppButton variant="ghost" size="sm" class="self-start" @click="emit('duplicate')">
        <template #leading><icon-lucide-copy class="size-3.5" /></template>
        {{ variables.duplicate }}
      </AppButton>
      <AppButton
        variant="ghost"
        color="error"
        size="sm"
        class="self-start"
        data-test-id="variables-delete-selected"
        @click="emit('remove')"
      >
        <template #leading><icon-lucide-trash-2 class="size-3.5" /></template>
        {{ variables.deleteVariables }}
      </AppButton>
    </section>
  </aside>
</template>
