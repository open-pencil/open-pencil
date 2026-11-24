<script setup lang="ts">
import IconArrowRight from '~icons/lucide/arrow-right'
import IconHistory from '~icons/lucide/history'
import IconLayoutGrid from '~icons/lucide/layout-grid'
import IconMessageSquare from '~icons/lucide/message-square'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconServer from '~icons/lucide/server'
import IconSparkles from '~icons/lucide/sparkles'
import IconTag from '~icons/lucide/tag'

import { LINKS } from '../content/links'
import { useLandingMessages } from '../content/messages'
import ActionButton from '../ui/ActionButton.vue'

const messages = useLandingMessages()

/** One per feature, in the order every locale lists them: sync, sharing, history, AI, self-hosting. */
const ICONS = [IconRefreshCw, IconMessageSquare, IconHistory, IconSparkles, IconServer]
</script>

<template>
  <!-- The closing section's Cloud button links here. -->
  <section id="cloud" class="landing-section">
    <span class="landing-badge">{{ messages.cloud.badge }}</span>
    <h2>{{ messages.cloud.title }}</h2>
    <p class="lede">{{ messages.cloud.lede }}</p>
    <div class="actions">
      <ActionButton :href="LINKS.cloud" :icon="IconArrowRight" primary>
        {{ messages.cloud.signUp }}
      </ActionButton>
      <ActionButton :href="LINKS.pricing" :icon="IconTag">{{ messages.cloud.plans }}</ActionButton>
      <ActionButton :href="LINKS.community" :icon="IconLayoutGrid">
        {{ messages.cloud.community }}
      </ActionButton>
    </div>
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
.lede {
  max-width: 640px;
  margin-top: 16px;
  color: var(--vp-c-text-2);
  font-size: 18px;
  line-height: 1.6;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

/* Five features fit one row on a desktop instead of leaving one alone on the next. */
.landing-facts {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 36px 40px;
  margin-top: 56px;
}
</style>
