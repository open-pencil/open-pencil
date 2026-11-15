<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { useI18n } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import theme from '@/theme/settings/ai-setup/welcome'

/** The first-run welcome: what AI in OpenPencil does, and the tour where it is offered. */
const {
  offersTour = true,
  tourOpening = false,
  tourFailed = false
} = defineProps<{
  /** Offered over the demo, which is the tour, it does not point to it. */
  offersTour?: boolean
  /** The tour is loading after the person chose it. */
  tourOpening?: boolean
  /** The tour could not be opened; the person can try again. */
  tourFailed?: boolean
}>()
const emit = defineEmits<{ tour: [] }>()
const { ai } = useI18n()
const styles = tv(theme)()
</script>

<template>
  <section :class="styles.intro()">
    <h3 :class="styles.heading()">{{ ai.aiSetupWelcomeAITitle }}</h3>
    <p :class="styles.text()">{{ ai.aiSetupWelcomeAIDescription }}</p>
  </section>
  <section v-if="offersTour" :class="styles.tour()" data-test-id="ai-setup-tour">
    <div :class="styles.tourText()">
      <h3 :class="styles.heading()">{{ ai.aiSetupWelcomeTourTitle }}</h3>
      <p :class="styles.text()">{{ ai.aiSetupWelcomeTourDescription }}</p>
    </div>
    <AppButton
      variant="outline"
      :class="styles.tourAction()"
      :loading="tourOpening"
      @click="emit('tour')"
    >
      {{ ai.aiSetupTakeTour }}
    </AppButton>
  </section>
  <AppAlert
    v-if="offersTour && tourFailed"
    tone="error"
    :heading="ai.aiSetupTourFailed"
    data-test-id="ai-setup-tour-failed"
  />
</template>
