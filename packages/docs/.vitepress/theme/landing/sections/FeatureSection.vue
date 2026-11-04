<script setup lang="ts">
import { computed } from 'vue'
import IconMousePointerClick from '~icons/lucide/mouse-pointer-click'

import type { FeatureKind } from '../content/features'
import { useLandingMessages } from '../content/messages'
import StageFrame from '../ui/StageFrame.vue'

/** `flipped` puts the copy before the stage, on the left. */
const { kind, flipped = false } = defineProps<{ kind: FeatureKind; flipped?: boolean }>()

const messages = useLandingMessages()
const block = computed(() => messages.value.features[kind])
</script>

<template>
  <section class="landing-section">
    <h2>{{ block.title }}</h2>
    <div class="body" :data-flipped="flipped || undefined">
      <div class="stage">
        <StageFrame :kind="kind" />
      </div>
      <div class="copy">
        <p>{{ block.detail }}</p>
        <p class="hint"><IconMousePointerClick aria-hidden="true" />{{ block.hint }}</p>
        <!-- Supporting detail for one block, such as a list of agents or commands, comes last. -->
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 48px;
  align-items: start;
  margin-top: 36px;
}

.body[data-flipped] {
  grid-template-columns: 300px minmax(0, 1fr);
}

.stage {
  height: 460px;
}

.body[data-flipped] .copy {
  order: -1;
}

.copy {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 4px;
  color: var(--vp-c-text-2);
  font-size: 16px;
  line-height: 1.65;
}

.hint {
  display: flex;
  gap: 8px;
  color: var(--vp-c-text-1);
  font-size: 14px;
  line-height: 1.5;
}

.hint svg {
  flex: none;
  margin-top: 3px;
  color: var(--vp-c-brand-1);
}

@media (max-width: 860px) {
  /* Text first on a phone: read what the block is, then meet the canvas. */
  .body,
  .body[data-flipped] {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
    margin-top: 20px;
  }

  .copy {
    order: -1;
  }

  .stage {
    height: 560px;
  }
}
</style>
