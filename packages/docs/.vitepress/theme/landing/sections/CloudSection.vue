<script setup lang="ts">
import IconLibrary from '~icons/lucide/library'
import IconMessageSquare from '~icons/lucide/message-square'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconShieldCheck from '~icons/lucide/shield-check'
import IconSparkles from '~icons/lucide/sparkles'

import { useLandingMessages } from '../content/messages'
import WaitlistForm from '../waitlist/WaitlistForm.vue'

const messages = useLandingMessages()

/** One per feature, in the order every locale lists them: sync, sharing, libraries, AI, admin. */
const ICONS = [IconRefreshCw, IconMessageSquare, IconLibrary, IconSparkles, IconShieldCheck]
</script>

<template>
  <!-- The closing section's Cloud button links here. -->
  <section id="cloud" class="landing-section">
    <span class="badge">{{ messages.cloud.badge }}</span>
    <h2>{{ messages.cloud.title }}</h2>
    <p class="lede">{{ messages.cloud.lede }}</p>
    <WaitlistForm class="form" />
    <dl class="landing-facts">
      <div v-for="(feature, index) in messages.cloud.features" :key="feature.title">
        <component :is="ICONS[index]" class="icon" aria-hidden="true" />
        <dt>{{ feature.title }}</dt>
        <dd>{{ feature.detail }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.badge {
  display: inline-block;
  margin-bottom: 16px;
  padding: 2px 10px;
  border: 1px solid var(--vp-c-brand-soft);
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
}

.lede {
  max-width: 640px;
  margin-top: 16px;
  color: var(--vp-c-text-2);
  font-size: 18px;
  line-height: 1.6;
}

.form {
  margin-top: 28px;
}

/* Five features fit one row on a desktop instead of leaving one alone on the next. */
.landing-facts {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 36px 40px;
  margin-top: 56px;
}

.icon {
  display: block;
  width: 24px;
  height: 24px;
  margin-bottom: 14px;
  color: var(--vp-c-brand-1);
}
</style>
