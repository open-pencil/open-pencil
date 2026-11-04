<script setup lang="ts">
import * as v from 'valibot'
import { computed, ref, watch } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalForm } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
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

const ui = portalForm()
const messages = useCloudPortalMessages()
const current = ref('')
const next = ref('')
const repeat = ref('')
const errors = ref<{ current?: string; next?: string; repeat?: string }>({})
// Cleared as it opens: clearing as it closes would empty the fields during its exit animation.
watch(open, (value) => {
  if (value) {
    current.value = ''
    next.value = ''
    repeat.value = ''
    errors.value = {}
  }
})

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
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="purpose === 'change' ? messages.changePasswordTitle : messages.confirmPasswordTitle"
      :close-label="messages.cancel"
    />
    <form novalidate @submit.prevent="submit">
      <AppDialogBody :ui="{ body: 'flex flex-col gap-3' }">
        <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
        <div :class="ui.field()">
          <label for="portal-current-password" :class="ui.label()">
            {{ messages.currentPassword }}
          </label>
          <AppPasswordInput
            id="portal-current-password"
            v-model="current"
            autocomplete="current-password"
            :state="errors.current ? 'invalid' : 'idle'"
          />
          <p v-if="errors.current" :class="ui.error()">{{ errors.current }}</p>
        </div>
        <div v-if="purpose === 'change'" :class="ui.field()">
          <label for="portal-next-password" :class="ui.label()">{{ messages.newPassword }}</label>
          <AppPasswordInput
            id="portal-next-password"
            v-model="next"
            autocomplete="new-password"
            :state="errors.next ? 'invalid' : 'idle'"
          />
          <p v-if="errors.next" :class="ui.error()">{{ errors.next }}</p>
          <p v-else :class="ui.hint()">
            {{ messages.passwordHint({ count: minimumPasswordLength }) }}
          </p>
        </div>
        <div v-if="purpose === 'change'" :class="ui.field()">
          <label for="portal-repeat-password" :class="ui.label()">
            {{ messages.repeatPassword }}
          </label>
          <AppPasswordInput
            id="portal-repeat-password"
            v-model="repeat"
            autocomplete="new-password"
            :state="errors.repeat ? 'invalid' : 'idle'"
          />
          <p v-if="errors.repeat" :class="ui.error()">{{ errors.repeat }}</p>
        </div>
      </AppDialogBody>
      <AppDialogFooter :ui="{ footer: 'justify-between' }">
        <AppButton type="button" @click="open = false">{{ messages.cancel }}</AppButton>
        <AppButton type="submit" color="primary" variant="solid" :loading="saving">
          {{ purpose === 'change' ? messages.savePassword : messages.continue }}
        </AppButton>
      </AppDialogFooter>
    </form>
  </AppDialogRoot>
</template>
