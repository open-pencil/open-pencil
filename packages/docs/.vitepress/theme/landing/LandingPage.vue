<script setup lang="ts">
import SchemaOrg from '../SchemaOrg.vue'
import { FEATURE_KINDS } from './content/features'
import AgentList from './sections/AgentList.vue'
import ClosingSection from './sections/ClosingSection.vue'
import CloudSection from './sections/CloudSection.vue'
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
    <SchemaOrg />
  </div>
</template>
