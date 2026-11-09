<script setup lang="ts">
import * as v from 'valibot'
import { computed, ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppPasswordInput from '@/components/ui/input/AppPasswordInput.vue'

/**
 * Asks for passwords: the current one to confirm a sensitive change, and a new one when the
 * change is the password itself.
 */
const {
  purpose,
  minimumPasswordLength = 8,
  error = null,
  saving = false
} = defineProps<{
  purpose: 'confirm' | 'change'
  minimumPasswordLength?: number
  error?: string | null
  saving?: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [passwords: { current: string; next: string }] }>()

const messages = useCloudPortalMessages()
const current = ref('')
const next = ref('')
const repeat = ref('')
const errors = ref<{ current?: string; next?: string; repeat?: string }>({})
function reset() {
  current.value = ''
  next.value = ''
  repeat.value = ''
  errors.value = {}
}

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
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="purpose === 'change' ? messages.changePasswordTitle : messages.confirmPasswordTitle"
    :close-label="messages.cancel"
    :cancel-label="messages.cancel"
    :submit-label="purpose === 'change' ? messages.savePassword : messages.continue"
    :error="error"
    :error-heading="messages.errorTitle"
    :saving="saving"
    @open="reset"
    @submit="submit"
  >
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
  </AppFormDialog>
</template>
