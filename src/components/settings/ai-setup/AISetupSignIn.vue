<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { OnboardingConnectionState } from '@/app/ai/models/settings/onboarding/connections'
import type {
  OnboardingSignInProvider,
  OnboardingSignInStatus
} from '@/app/ai/models/settings/onboarding/sign-in'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import theme from '@/theme/settings/ai-setup/flow'

/**
 * Signing in to a provider, and the account it signed in to. OpenRouter's sign-in creates a key
 * that could also be pasted; ChatGPT has no key, so the sign-in is the only way to connect.
 */
const {
  provider,
  account,
  status = 'idle',
  disabled = false
} = defineProps<{
  provider: OnboardingSignInProvider
  account: OnboardingConnectionState['account']
  status?: OnboardingSignInStatus
  disabled?: boolean
}>()
const emit = defineEmits<{ signIn: []; reopen: []; cancel: []; signOut: [] }>()
const { ai, common } = useI18n()
const styles = tv(theme)()

const text = computed(() =>
  provider === 'chatgpt'
    ? {
        signIn: ai.value.aiSetupChatGPTSignIn,
        waiting: ai.value.aiSetupChatGPTWaiting,
        // The account is read from the tokens the sign-in returned, so nothing is left to check.
        verifying: ai.value.aiSetupChatGPTWaiting,
        signedIn: ai.value.aiSetupChatGPTSignedInTitle,
        failed: ai.value.aiSetupChatGPTFailed
      }
    : {
        signIn: ai.value.aiSetupOpenRouterSignIn,
        waiting: ai.value.aiSetupOpenRouterWaiting,
        verifying: ai.value.aiSetupOpenRouterVerifying,
        signedIn: ai.value.aiSetupOpenRouterSignedInTitle,
        failed: ai.value.aiSetupOpenRouterFailed
      }
)

const detail = computed(() => {
  if (account?.provider === 'chatgpt') return account.email
  if (account?.provider === 'openrouter' && account.label) {
    return ai.value.aiSetupOpenRouterKeyLabel({ label: account.label })
  }
  return undefined
})

const failure = computed(() => {
  if (status === 'blocked') return ai.value.aiSetupOpenRouterBlocked
  if (status === 'cancelled') return ai.value.aiSetupSignInCancelled
  if (status === 'expired') return ai.value.aiSetupSignInExpired
  if (status === 'port-in-use') return ai.value.aiSetupChatGPTPortInUse
  if (status === 'failed') return text.value.failed
  return null
})
</script>

<template>
  <template v-if="account">
    <div :class="styles.signIn()" data-slot="signed-in">
      <p role="status" :class="styles.signInStatus()">
        <icon-lucide-circle-check :class="styles.signedInIcon()" aria-hidden="true" />
        <span>
          {{ text.signedIn }}
          <span v-if="detail" :class="styles.signInDetail()">{{ detail }}</span>
        </span>
      </p>
      <AppButton size="xs" @click="emit('signOut')">{{ ai.aiSetupSignInChange }}</AppButton>
    </div>
    <AppAlert
      v-if="account.provider === 'openrouter' && account.freeTier"
      tone="warning"
      :heading="ai.aiSetupOpenRouterNoCredits"
    />
  </template>
  <template v-else>
    <div v-if="status === 'waiting' || status === 'verifying'" :class="styles.signIn()">
      <p role="status" :class="styles.signInStatus()">
        <icon-lucide-loader-2 :class="styles.spinner()" aria-hidden="true" />
        {{ status === 'waiting' ? text.waiting : text.verifying }}
      </p>
      <div :class="styles.signInActions()">
        <AppButton v-if="status === 'waiting'" size="xs" variant="outline" @click="emit('reopen')">
          {{ ai.aiSetupSignInReopen }}
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
      {{ text.signIn }}
    </AppButton>
    <AppAlert v-if="failure" tone="warning" :heading="failure" />
    <p v-if="provider === 'openrouter'" :class="styles.groupHeading()">
      {{ ai.aiSetupOpenRouterOrKey }}
    </p>
  </template>
</template>
