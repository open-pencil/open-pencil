<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalForm } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

import PortalPublicLayout from '../layout/PortalPublicLayout.vue'

/**
 * Approving a sign-in started in the desktop app: the person types the code the app shows, and
 * only a match lets them approve. The page never shows the code it was opened with, so a link
 * someone else sent cannot be approved with one click.
 */
const {
  host,
  code,
  email,
  deciding = false,
  error = null
} = defineProps<{
  host: string
  code: string
  /** The signed-in account the app would use. */
  email: string
  deciding?: boolean
  /** Why the last approval or denial didn't go through; the person can try again. */
  error?: string | null
}>()
const emit = defineEmits<{ approve: []; deny: [] }>()
const messages = useCloudPortalMessages()
const ui = portalForm({ size: 'lg' })
const entered = ref('')
const normalized = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')
const matches = computed(() => normalized(entered.value) === normalized(code))
</script>

<template>
  <PortalPublicLayout
    :host="host"
    :heading="messages.deviceTitle"
    :description="messages.deviceDescription({ email })"
  >
    <AppInput
      v-model="entered"
      size="lg"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      :aria-label="messages.deviceEnterCode"
      :placeholder="messages.deviceEnterCode"
      :ui="{ input: ui.code() }"
    />
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <AppAlert
      tone="warning"
      :heading="messages.deviceWarningTitle"
      :description="messages.deviceWarningDescription"
    />
    <div :class="ui.methods()">
      <AppButton
        size="lg"
        color="primary"
        variant="solid"
        :class="ui.submit()"
        :loading="deciding"
        :disabled="!matches"
        @click="emit('approve')"
      >
        {{ messages.approve }}
      </AppButton>
      <AppButton
        size="lg"
        variant="outline"
        :class="ui.submit()"
        :disabled="deciding"
        @click="emit('deny')"
      >
        {{ messages.deny }}
      </AppButton>
    </div>
  </PortalPublicLayout>
</template>
