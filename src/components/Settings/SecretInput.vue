<script setup lang="ts">
import { ref, useAttrs } from 'vue'
import { useI18n } from '@open-pencil/vue'

import AppInput from '@/components/ui/AppInput.vue'

defineOptions({ inheritAttrs: false })

const { placeholder } = defineProps<{
  placeholder?: string
}>()

const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ change: [] }>()
const attrs = useAttrs()
const { dialogs } = useI18n()
const revealed = ref(false)

function toggle() {
  revealed.value = !revealed.value
}
</script>

<template>
  <div class="relative flex min-w-0 flex-1 items-center">
    <AppInput
      v-model="modelValue"
      v-bind="attrs"
      :type="revealed ? 'text' : 'password'"
      :placeholder="placeholder"
      size="sm"
      class="w-full pr-8"
      @change="emit('change')"
    />
    <button
      type="button"
      class="absolute right-1.5 rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
      data-test-id="secret-input-toggle"
      :aria-label="revealed ? dialogs.hideSecret : dialogs.showSecret"
      :aria-pressed="revealed"
      @click="toggle"
    >
      <icon-lucide-eye-off v-if="revealed" class="size-3.5" />
      <icon-lucide-eye v-else class="size-3.5" />
    </button>
  </div>
</template>
