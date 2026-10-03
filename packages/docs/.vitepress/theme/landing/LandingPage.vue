<script setup lang="ts">
import SchemaOrg from '../SchemaOrg.vue'
import { FEATURE_KINDS } from './content/features'
import AgentList from './sections/AgentList.vue'
import ClosingSection from './sections/ClosingSection.vue'
import CommandList from './sections/CommandList.vue'
import FeatureSection from './sections/FeatureSection.vue'
import HeroSection from './sections/HeroSection.vue'
import OwnershipSection from './sections/OwnershipSection.vue'
import RoadmapSection from './sections/RoadmapSection.vue'

import './landing.css'
</script>

<template>
  <div class="landing">
    <HeroSection />
    <FeatureSection v-for="kind in FEATURE_KINDS" :key="kind" :kind="kind">
      <AgentList v-if="kind === 'ai'" />
      <CommandList v-else-if="kind === 'script'" />
    </FeatureSection>
    <OwnershipSection />
    <RoadmapSection />
    <ClosingSection />
    <SchemaOrg />
  </div>
</template>
