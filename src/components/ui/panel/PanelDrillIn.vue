<script setup lang="ts">
import { FocusScope } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { ref } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import type { ComponentUI } from '@/components/ui/types'
import { drillInTransition } from '@/theme/motion/styles'
import drillInTheme from '@/theme/panel/drill-in'

/**
 * A list with a detail view that slides in over it. Given a `parent`, a bar above the detail
 * holds the back control, which names the view it returns to, like "‹ Models"; without one the
 * way back is drawn elsewhere, such as a window's breadcrumb. Focus moves into the detail as it
 * opens, to the back control unless `open-auto-focus` is prevented to focus a field instead, and
 * back to what opened it. `closed` fires once the detail has slid away, for state that would
 * show changing if it were reset while the detail was still on screen.
 */
const { open, back, parent, ui } = defineProps<{
  open: boolean
  /** The accessible verb, "Back". */
  back?: string
  /** What Back returns to, shown on the control: "Models". */
  parent?: string
  ui?: ComponentUI<typeof drillInTheme>
}>()
const emit = defineEmits<{ back: []; closed: []; openAutoFocus: [event: Event] }>()

const styles = tv(drillInTheme)()
/**
 * The list stays under the detail's background while its content slides in, then hides. It is
 * inert from the moment the detail opens, and a closing detail is inert while it slides away, so
 * the two never share the tab order.
 */
const covered = ref(false)

function uncover(element: Element) {
  if (element instanceof HTMLElement) element.inert = true
  covered.value = false
}
</script>

<template>
  <div :class="styles.root({ class: ui?.root })">
    <Transition
      v-bind="drillInTransition"
      @after-enter="covered = true"
      @before-leave="uncover"
      @after-leave="emit('closed')"
    >
      <FocusScope
        v-if="open"
        data-slot="detail"
        :class="styles.detail({ class: ui?.detail })"
        @mount-auto-focus="emit('openAutoFocus', $event)"
      >
        <div v-if="parent" data-slot="header" :class="styles.header({ class: ui?.header })">
          <AppButton variant="ghost" size="sm" data-slot="back" @click="emit('back')">
            <template #leading><icon-lucide-chevron-left class="size-4" /></template>
            <span class="sr-only">{{ back }}:</span>
            {{ parent }}
          </AppButton>
          <span class="flex-1" />
          <slot name="actions" />
        </div>
        <div data-slot="body" :class="styles.body({ class: ui?.body })">
          <slot name="detail" />
        </div>
      </FocusScope>
    </Transition>
    <div v-show="!covered" :inert="open" data-slot="base" :class="styles.base({ class: ui?.base })">
      <slot />
    </div>
  </div>
</template>
