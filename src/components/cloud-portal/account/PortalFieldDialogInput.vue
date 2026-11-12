<script setup lang="ts">
import * as v from 'valibot'
import { ref } from 'vue'

import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

/**
 * The field of `PortalFieldDialog`. It lives inside the dialog's content, which mounts as the
 * dialog opens and unmounts once it has closed, so each opening starts from `initial` with no
 * error. The dialog's submit calls `submit`, which checks the value with `schema`.
 */
const {
  label,
  schema,
  initial = '',
  type = 'text',
  autocomplete,
  placeholder,
  maxlength
} = defineProps<{
  label: string
  schema: v.GenericSchema<string, string>
  initial?: string
  type?: 'text' | 'email'
  autocomplete?: string
  placeholder?: string
  maxlength?: number
}>()
const emit = defineEmits<{ submit: [value: string] }>()

const value = ref(initial)
const invalid = ref<string | null>(null)

function submit() {
  const result = v.safeParse(schema, value.value)
  invalid.value = result.success ? null : result.issues[0].message
  if (result.success) emit('submit', result.output)
}
defineExpose({ submit })
</script>

<template>
  <AppFormField :label="label" :error="invalid">
    <template #default="{ id, invalid: hasError, describedBy }">
      <AppInput
        :id="id"
        v-model="value"
        :type="type"
        :autocomplete="autocomplete"
        :maxlength="maxlength"
        autofocus
        :placeholder="placeholder"
        :state="hasError ? 'invalid' : 'idle'"
        :aria-invalid="hasError || undefined"
        :aria-describedby="describedBy"
      />
    </template>
  </AppFormField>
</template>
