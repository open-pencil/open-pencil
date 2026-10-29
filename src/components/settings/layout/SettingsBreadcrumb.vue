<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { vTestId } from '@open-pencil/vue/testing'

import theme from '@/theme/settings/breadcrumb'

/**
 * Where an open editor sits, drawn as the window's title: each earlier step leads back to the
 * list the editor came from, and the editor's own name gives way first to a narrow window.
 */
const { steps, current } = defineProps<{ steps: string[]; current: string }>()
const emit = defineEmits<{ back: [] }>()
const styles = tv(theme)()
</script>

<template>
  <span :class="styles.root()" data-test-id="settings-breadcrumb">
    <template v-for="(step, index) in steps" :key="index">
      <button
        type="button"
        :class="styles.step()"
        v-test-id="index === steps.length - 1 ? 'settings-editor-back' : undefined"
        @click="emit('back')"
      >
        {{ step }}
      </button>
      <icon-lucide-chevron-right :class="styles.separator()" aria-hidden="true" />
    </template>
    <span :class="styles.current()" aria-current="page">{{ current }}</span>
  </span>
</template>
