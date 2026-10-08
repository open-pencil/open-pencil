<script setup lang="ts">
import { FEATURE_KINDS } from './content/features'
import { provideLandingMessages, type LandingMessages } from './content/messages'
import AgentList from './sections/AgentList.vue'
import ClosingSection from './sections/ClosingSection.vue'
import CloudSection from './sections/CloudSection.vue'
import CommandList from './sections/CommandList.vue'
import FeatureSection from './sections/FeatureSection.vue'
import HeroSection from './sections/HeroSection.vue'
import OwnershipSection from './sections/OwnershipSection.vue'
import RoadmapSection from './sections/RoadmapSection.vue'

import './landing.css'

/** The copy of the page's locale, imported by that locale's `index.md`. */
const { messages } = defineProps<{ messages: LandingMessages }>()
provideLandingMessages(messages)
</script>

<template>
  <div class="landing">
    <HeroSection />
    <!-- Blocks alternate sides, so the page reads as a zigzag rather than a column. -->
    <FeatureSection
      v-for="(kind, index) in FEATURE_KINDS"
      :key="kind"
      :kind="kind"
      :flipped="index % 2 === 1"
    >
      <AgentList v-if="kind === 'ai'" />
      <CommandList v-else-if="kind === 'script'" />
    </FeatureSection>
    <OwnershipSection />
    <CloudSection />
    <RoadmapSection />
    <ClosingSection />
  </div>
</template>
