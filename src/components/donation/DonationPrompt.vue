<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { useId } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { donate, donationPrompt, postponeDonation } from '@/app/donation'
import AppButton from '@/components/ui/button/AppButton.vue'
import donationTheme from '@/theme/donation'
import promptTheme from '@/theme/sharing/prompt'
import questionTheme from '@/theme/sharing/question'

/** The donation question, in the corner the usage stats question uses, on launches it is due. */
const { diagnostics } = useI18n()
const prompt = tv(promptTheme)()
const styles = tv(questionTheme)()
const donation = tv(donationTheme)()
const headingId = useId()
</script>

<template>
  <aside
    v-if="donationPrompt"
    :class="prompt.root()"
    :aria-labelledby="headingId"
    data-test-id="donation-prompt"
  >
    <section :class="styles.root()">
      <h3 :id="headingId" :class="donation.heading()">
        <icon-lucide-heart :class="donation.heart()" aria-hidden="true" />
        {{ diagnostics.supportTitle }}
      </h3>
      <p :class="styles.text()">{{ diagnostics.supportDescription }}</p>
      <div :class="styles.actions()">
        <AppButton variant="outline" @click="postponeDonation()">
          {{ diagnostics.supportNotNow }}
        </AppButton>
        <AppButton color="primary" variant="solid" @click="donate('prompt')">
          {{ diagnostics.supportDonate }}
        </AppButton>
      </div>
    </section>
  </aside>
</template>
