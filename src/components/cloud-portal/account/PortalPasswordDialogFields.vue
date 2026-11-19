<script setup lang="ts">
import * as v from 'valibot'
import { computed, ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppPasswordInput from '@/components/ui/input/AppPasswordInput.vue'

/**
 * The fields of `PortalPasswordDialog`. They live inside the dialog's content, which mounts as
 * the dialog opens and unmounts once it has closed, so each opening starts empty. The dialog's
 * submit calls `submit`, which checks them before sending.
 */
const { purpose, minimumPasswordLength } = defineProps<{
  purpose: 'confirm' | 'change'
  minimumPasswordLength: number
}>()
const emit = defineEmits<{ submit: [passwords: { current: string; next: string }] }>()

const messages = useCloudPortalMessages()
const current = ref('')
const next = ref('')
const repeat = ref('')
const errors = ref<{ current?: string; next?: string; repeat?: string }>({})

/** What the server would turn down, caught before it is asked. */
const schema = computed(() => {
  const words = messages.value
  const fields = v.object({
    current: v.pipe(v.string(), v.nonEmpty(words.errorPasswordRequired)),
    next: v.pipe(
      v.string(),
      v.minLength(
        minimumPasswordLength,
        words.errorPasswordTooShort({ count: minimumPasswordLength })
      )
    ),
    repeat: v.string()
  })
  if (purpose === 'confirm') {
    return v.object({ current: fields.entries.current, next: v.string(), repeat: v.string() })
  }
  return v.pipe(
    fields,
    v.forward(
      v.partialCheck(
        [['next'], ['repeat']],
        (input) => input.next === input.repeat,
        words.errorPasswordsDiffer
      ),
      ['repeat']
    )
  )
})

function submit() {
  const result = v.safeParse(schema.value, {
    current: current.value,
    next: next.value,
    repeat: repeat.value
  })
  if (!result.success) {
    const flat = v.flatten<typeof schema.value>(result.issues).nested ?? {}
    errors.value = { current: flat.current?.[0], next: flat.next?.[0], repeat: flat.repeat?.[0] }
    return
  }
  errors.value = {}
  emit('submit', { current: current.value, next: next.value })
}
defineExpose({ submit })
</script>

<template>
  <AppFormField :label="messages.currentPassword" :error="errors.current">
    <template #default="{ id, invalid, describedBy }">
      <AppPasswordInput
        :id="id"
        v-model="current"
        autofocus
        autocomplete="current-password"
        :state="invalid ? 'invalid' : 'idle'"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedBy"
      />
    </template>
  </AppFormField>
  <template v-if="purpose === 'change'">
    <AppFormField
      :label="messages.newPassword"
      :error="errors.next"
      :hint="messages.passwordHint({ count: minimumPasswordLength })"
    >
      <template #default="{ id, invalid, describedBy }">
        <AppPasswordInput
          :id="id"
          v-model="next"
          autocomplete="new-password"
          :state="invalid ? 'invalid' : 'idle'"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
        />
      </template>
    </AppFormField>
    <AppFormField :label="messages.repeatPassword" :error="errors.repeat">
      <template #default="{ id, invalid, describedBy }">
        <AppPasswordInput
          :id="id"
          v-model="repeat"
          autocomplete="new-password"
          :state="invalid ? 'invalid' : 'idle'"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
        />
      </template>
    </AppFormField>
  </template>
</template>
