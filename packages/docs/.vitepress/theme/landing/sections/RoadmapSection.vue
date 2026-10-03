<script setup lang="ts">
import { computed } from 'vue'
import IconArrowRight from '~icons/lucide/arrow-right'

import { LINKS } from '../content/links'
import { useLandingMessages, useLocalePath } from '../content/messages'

const messages = useLandingMessages()
const localePath = useLocalePath()

/** The catalog keeps the stages apart so each has its own shape; the timeline wants a list. */
const stages = computed(() => {
  const { now, next, later } = messages.value.roadmap
  return [
    { label: now.label, current: true, entries: now.entries.map(withoutFeatures) },
    {
      label: next.label,
      current: false,
      entries: [next.lead, ...next.entries.map(withoutFeatures)]
    },
    { label: later.label, current: false, entries: later.entries.map(withoutFeatures) }
  ]
})

function withoutFeatures(entry: { title: string; detail?: string }) {
  return { ...entry, features: undefined }
}
</script>

<template>
  <section class="landing-section">
    <h2>{{ messages.roadmap.title }}</h2>
    <ol class="timeline">
      <li
        v-for="stage in stages"
        :key="stage.label"
        class="stage"
        :data-current="stage.current || undefined"
      >
        <span class="label">{{ stage.label }}</span>
        <ul>
          <li
            v-for="entry in stage.entries"
            :key="entry.title"
            class="entry"
            :data-lead="entry.features ? true : undefined"
          >
            <h3>{{ entry.title }}</h3>
            <p v-if="entry.detail">{{ entry.detail }}</p>
            <dl v-if="entry.features" class="landing-facts">
              <div v-for="feature in entry.features" :key="feature.title">
                <dt>{{ feature.title }}</dt>
                <dd>{{ feature.detail }}</dd>
              </div>
            </dl>
          </li>
        </ul>
      </li>
    </ol>
    <!-- The full roadmap exists only in English, so every locale links to that page. -->
    <a class="more" :href="localePath(LINKS.roadmap, { translated: false })">
      {{ messages.roadmap.more }}<IconArrowRight aria-hidden="true" />
    </a>
  </section>
</template>

<style scoped>
.timeline {
  --rail: 96px;

  position: relative;
  margin-top: 48px;
}

/* The rail: one line down the page with a marker per stage. */
.timeline::before {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: calc(var(--rail) + 5px);
  width: 1px;
  background: var(--vp-c-divider);
  content: '';
}

.stage {
  position: relative;
  padding-left: calc(var(--rail) + 40px);
}

.stage + .stage {
  margin-top: 72px;
}

.stage::before {
  position: absolute;
  top: 6px;
  left: var(--rail);
  width: 11px;
  height: 11px;
  border: 2px solid var(--vp-c-text-3);
  border-radius: 50%;
  background: var(--vp-c-bg);
  content: '';
}

.stage[data-current]::before {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
}

.label {
  position: absolute;
  top: 0;
  left: 0;
  width: calc(var(--rail) - 20px);
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-weight: 600;
  line-height: 24px;
  text-align: right;
}

.stage[data-current] .label {
  color: var(--vp-c-brand-1);
}

.entry + .entry {
  margin-top: 28px;
}

.entry h3 {
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
}

.entry > p {
  max-width: 560px;
  margin-top: 4px;
  color: var(--vp-c-text-2);
  font-size: 15px;
  line-height: 1.6;
}

/* The one entry presented as a feature block of its own. */
.entry[data-lead] {
  padding-bottom: 20px;
}

.entry[data-lead] h3 {
  font-size: clamp(22px, 3vw, 28px);
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.2;
}

.entry[data-lead] > p {
  margin-top: 10px;
  font-size: 16px;
}

.entry[data-lead] .landing-facts {
  margin-top: 32px;
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 64px;
  color: var(--vp-c-brand-1);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
}

@media (max-width: 860px) {
  .timeline {
    --rail: 0px;
  }

  .stage {
    padding-left: 32px;
  }

  .label {
    position: static;
    display: block;
    width: auto;
    margin-bottom: 12px;
    text-align: left;
  }
}
</style>
