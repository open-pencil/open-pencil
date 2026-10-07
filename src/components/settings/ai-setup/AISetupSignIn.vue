<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import type { OnboardingConnectionState } from '@/app/ai/models/settings/onboarding/connections'
import type { OnboardingSignInStatus } from '@/app/ai/models/settings/onboarding/sign-in'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import theme from '@/theme/settings/ai-setup/flow'

/** Signing in to OpenRouter instead of pasting a key, and the account it signed in to. */
const {
  account,
  status = 'idle',
  disabled = false
} = defineProps<{
  account: OnboardingConnectionState['account']
  status?: OnboardingSignInStatus
  disabled?: boolean
}>()
const emit = defineEmits<{ signIn: []; reopen: []; cancel: []; signOut: [] }>()
const { ai, common } = useI18n()
const styles = tv(theme)()

const failure = computed(() => {
  if (status === 'blocked') return ai.value.aiSetupOpenRouterBlocked
  if (status === 'cancelled') return ai.value.aiSetupOpenRouterCancelled
  if (status === 'expired') return ai.value.aiSetupOpenRouterExpired
  if (status === 'failed') return ai.value.aiSetupOpenRouterFailed
  return null
})
</script>

<template>
  <template v-if="account">
    <div :class="styles.signIn()" data-slot="signed-in">
      <p role="status" :class="styles.signInStatus()">
        <icon-lucide-circle-check :class="styles.signedInIcon()" aria-hidden="true" />
        <span>
          {{ ai.aiSetupOpenRouterSignedInTitle }}
          <span v-if="account.label" :class="styles.signInDetail()">
            {{ ai.aiSetupOpenRouterKeyLabel({ label: account.label }) }}
          </span>
        </span>
      </p>
      <AppButton size="xs" @click="emit('signOut')">{{ ai.aiSetupOpenRouterChange }}</AppButton>
    </div>
    <AppAlert v-if="account.freeTier" tone="warning" :heading="ai.aiSetupOpenRouterNoCredits" />
  </template>
  <template v-else>
    <div v-if="status === 'waiting' || status === 'verifying'" :class="styles.signIn()">
      <p role="status" :class="styles.signInStatus()">
        <icon-lucide-loader-2 :class="styles.spinner()" aria-hidden="true" />
        {{ status === 'waiting' ? ai.aiSetupOpenRouterWaiting : ai.aiSetupOpenRouterVerifying }}
      </p>
      <div :class="styles.signInActions()">
        <AppButton v-if="status === 'waiting'" size="xs" variant="outline" @click="emit('reopen')">
          {{ ai.aiSetupOpenRouterReopen }}
        </AppButton>
        <AppButton size="xs" @click="emit('cancel')">{{ common.cancel }}</AppButton>
      </div>
    </div>
    <AppButton
      v-else
      class="self-start"
      color="primary"
      variant="solid"
      :disabled="disabled"
      @click="emit('signIn')"
    >
      {{ ai.aiSetupOpenRouterSignIn }}
    </AppButton>
    <AppAlert v-if="failure" tone="warning" :heading="failure" />
    <p :class="styles.groupHeading()">{{ ai.aiSetupOpenRouterOrKey }}</p>
  </template>
</template>
