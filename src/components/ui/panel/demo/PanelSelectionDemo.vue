<script setup lang="ts">
import { ref } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

import PanelSection from '../PanelSection.vue'

const container = ref(false)
</script>

<template>
  <div class="w-72 bg-panel text-surface">
    <AppButton @click="container = !container">Switch selection</AppButton>
    <PanelSection :label="container ? 'Auto layout' : 'Layout'">
      <template v-if="container" #actions>
        <IconButton label="Remove auto layout" active
          ><icon-lucide-layout-panel-top class="size-3.5"
        /></IconButton>
      </template>
      <p class="text-xs text-muted">{{ container ? 'Frame selection' : 'Rectangle selection' }}</p>
    </PanelSection>
  </div>
</template>
