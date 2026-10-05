<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { nextTick, ref, useTemplateRef, watch } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import type { ComponentUI } from '@/components/ui/types'
import { drillInTransition } from '@/theme/motion/styles'
import drillInTheme from '@/theme/panel/drill-in'

/**
 * A list with a detail view that slides in over it. The back control names the view it returns
 * to, like "‹ Models"; focus moves to the detail's first field and back to what opened it.
 */
const { open, back, parent, ui } = defineProps<{
  open: boolean
  /** The accessible verb, "Back". */
  back: string
  /** What Back returns to, shown on the control: "Models". */
  parent: string
  ui?: ComponentUI<typeof drillInTheme>
}>()
const emit = defineEmits<{ back: [] }>()

const styles = tv(drillInTheme)()
const body = useTemplateRef<HTMLElement>('body')
/**
 * The list shows under the detail while it slides, then hides once covered, so the two never
 * share the tab order.
 */
const covered = ref(false)
let returnFocus: HTMLElement | null = null

watch(
  () => open,
  (isOpen) => {
    if (isOpen && document.activeElement instanceof HTMLElement)
      returnFocus = document.activeElement
  }
)

const FIELD = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled])'

async function focusDetail() {
  covered.value = true
  await nextTick()
  body.value?.querySelector<HTMLElement>(FIELD)?.focus({ preventScroll: true })
}

function uncover() {
  covered.value = false
}

async function restoreFocus() {
  await nextTick()
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
  returnFocus = null
}
</script>

<template>
  <div :class="styles.root({ class: ui?.root })">
    <Transition
      v-bind="drillInTransition"
      @after-enter="focusDetail"
      @before-leave="uncover"
      @after-leave="restoreFocus"
    >
      <div v-if="open" data-slot="detail" :class="styles.detail({ class: ui?.detail })">
        <div data-slot="header" :class="styles.header({ class: ui?.header })">
          <AppButton variant="ghost" size="sm" data-test-id="drill-in-back" @click="emit('back')">
            <template #leading><icon-lucide-chevron-left class="size-4" /></template>
            <span class="sr-only">{{ back }}:</span>
            {{ parent }}
          </AppButton>
          <span class="flex-1" />
          <slot name="actions" />
        </div>
        <div ref="body" data-slot="body" :class="styles.body({ class: ui?.body })">
          <slot name="detail" />
        </div>
      </div>
    </Transition>
    <div v-show="!covered" data-slot="base" :class="styles.base({ class: ui?.base })">
      <slot />
    </div>
  </div>
</template>
