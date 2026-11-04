<script setup lang="ts">
import IconGithub from '~icons/lucide/github'
import IconShieldCheck from '~icons/lucide/shield-check'

import { provideLandingMessages, type LandingMessages } from '../content/messages'
import ActionButton from '../ui/ActionButton.vue'
import BetaSection from './BetaSection.vue'
import DownloadHero from './DownloadHero.vue'
import OtherWays from './OtherWays.vue'
import PlatformFiles from './PlatformFiles.vue'
import { data as releases } from './releases.data'
import { useVisitorSystem } from './visitor'

import '../landing.css'

/** The copy of the page's locale, imported by that locale's `download.md`. */
const { messages } = defineProps<{ messages: LandingMessages }>()
provideLandingMessages(messages)
const system = useVisitorSystem()
</script>

<template>
  <div class="landing download-page">
    <DownloadHero :release="releases.stable" :system="system" />
    <section v-if="releases.stable" id="all" class="landing-section">
      <header class="section-header">
        <h2>{{ messages.download.allTitle }}</h2>
        <div class="header-actions">
          <ActionButton
            v-if="releases.stable.checksums"
            :href="releases.stable.checksums"
            :icon="IconShieldCheck"
            small
          >
            {{ messages.download.checksums }}
          </ActionButton>
          <ActionButton :href="releases.stable.url" :icon="IconGithub" small>
            {{ messages.download.onGitHub }}
          </ActionButton>
        </div>
      </header>
      <PlatformFiles :release="releases.stable" :current="system?.platform" />
    </section>
    <BetaSection v-if="releases.beta" :release="releases.beta" :current="system?.platform" />
    <OtherWays />
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 24px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
