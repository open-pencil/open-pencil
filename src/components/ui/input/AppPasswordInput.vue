<script setup lang="ts">
import { ref } from 'vue'

import { useCommonMessages } from '@open-pencil/vue/i18n'

import type { ControlSize } from '@/theme/control'

import AppInput from './AppInput.vue'

/** A password field whose contents the person can show while typing, to check what they typed. */
defineOptions({ inheritAttrs: false })

const { id, size = 'md' } = defineProps<{
  id?: string
  size?: ControlSize
}>()

const value = defineModel<string>({ required: true })
const shown = ref(false)
const common = useCommonMessages()
</script>

<template>
  <AppInput
    :id="id"
    v-model="value"
    v-bind="$attrs"
    :type="shown ? 'text' : 'password'"
    :size="size"
  >
    <template #trailing>
      <button
        type="button"
        class="flex size-6 cursor-pointer items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
        :aria-label="shown ? common.hidePassword : common.showPassword"
        :aria-pressed="shown"
        @click="shown = !shown"
      >
        <icon-lucide-eye-off v-if="shown" class="size-3.5" />
        <icon-lucide-eye v-else class="size-3.5" />
      </button>
    </template>
  </AppInput>
</template>
