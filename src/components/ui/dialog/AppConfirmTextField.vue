<script setup lang="ts">
import { ref, watch } from 'vue'

import { useCommonMessages } from '@open-pencil/vue/i18n'

import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

/**
 * Asks for something typed out, such as a workspace's name or the account's email, before an
 * action that cannot be undone. Spaces around it and letter case don't matter. The text lives
 * here, so it starts empty each time the dialog around it opens and keeps what was typed while
 * the dialog animates closed.
 */
const { expected } = defineProps<{ expected: string }>()
/** Whether what was typed matches. */
const matched = defineModel<boolean>('matched', { default: false })
const emit = defineEmits<{ enter: [] }>()

const common = useCommonMessages()
const typed = ref('')
watch(
  [typed, () => expected],
  () => {
    matched.value =
      typed.value.trim().localeCompare(expected.trim(), undefined, { sensitivity: 'accent' }) === 0
  },
  { immediate: true }
)
</script>

<template>
  <AppFormField :label="common.typeToConfirm({ text: expected })">
    <template #default="{ id }">
      <AppInput
        :id="id"
        v-model="typed"
        autocomplete="off"
        spellcheck="false"
        @enter="emit('enter')"
      />
    </template>
  </AppFormField>
</template>
