<script setup lang="ts">
import { computed } from 'vue'

import { dropOverlay, type DropOverlayProps } from './drop-overlay'

const { visible, label, shape = 'surface', accepts = true, ui } = defineProps<DropOverlayProps>()

const cls = computed(() => dropOverlay({ shape, accepts }))
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150"
    leave-to-class="opacity-0"
  >
    <div v-if="visible" data-slot="drop-overlay" :class="cls.root({ class: ui?.root })">
      <span v-if="label" role="status" :class="cls.label({ class: ui?.label })">
        <icon-lucide-image-plus v-if="accepts" class="size-3.5" />
        {{ label }}
      </span>
    </div>
  </Transition>
</template>
