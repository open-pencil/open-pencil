<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { ref } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { AgentAccountView } from '@/app/ai/agents/setup/view'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import theme from '@/theme/settings/agents'

/** An agent's own login while it runs: the browser does the work, with a code as fallback. */
const { account } = defineProps<{ account: AgentAccountView }>()
const emit = defineEmits<{ submitCode: [code: string] }>()
const { ai } = useI18n()
const styles = tv(theme)()
const code = ref('')

function submit() {
  const value = code.value.trim()
  if (!value) return
  emit('submitCode', value)
  code.value = ''
}
</script>

<template>
  <div :class="styles.signIn()">
    <p role="status" :class="styles.status()">
      <icon-lucide-loader-2 :class="styles.spinner()" aria-hidden="true" />
      {{ ai.aiSetupAgentSignInBrowser }}
    </p>
    <SettingsLink v-if="account.signInURL" :href="account.signInURL">
      {{ ai.aiSetupAgentSignInOpenPage }}
    </SettingsLink>
    <form v-if="account.acceptsCode" :class="styles.code()" @submit.prevent="submit">
      <AppInput
        v-model="code"
        class="flex-1"
        :aria-label="ai.aiSetupAgentSignInCode"
        :placeholder="ai.aiSetupAgentSignInCode"
      />
      <AppButton size="xs" variant="outline" type="submit" :disabled="!code.trim()">
        {{ ai.aiSetupAgentSignInSubmitCode }}
      </AppButton>
    </form>
  </div>
</template>
