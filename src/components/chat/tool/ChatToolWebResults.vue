<script setup lang="ts">
import { compact } from 'es-toolkit'

import type { SearchResult } from '@open-pencil/cloud/contract'
import { useI18n } from '@open-pencil/vue/i18n'

import { useDateFormat } from '@/app/i18n/date'
import { openExternalLink } from '@/app/shell/ui'

import { chatToolSourcesTheme } from './ui'

/** The pages a web search found: each title opens the page, under its site and date. */
const { results } = defineProps<{ results: SearchResult[] }>()
const { ai } = useI18n()
const dates = useDateFormat()
const ui = chatToolSourcesTheme()

function site(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '')
}

function meta(result: SearchResult): string {
  const date = result.publishedAt ? dates.format(result.publishedAt, 'date') : ''
  return compact([site(result.url), result.author, date]).join(' · ')
}
</script>

<template>
  <p v-if="results.length === 0" :class="ui.empty()">{{ ai.webSearchNothingFound }}</p>
  <ol v-else :class="ui.root()" :aria-label="ai.webSearchSources">
    <li v-for="result in results" :key="result.url" :class="ui.source()">
      <button type="button" :class="ui.title()" @click="openExternalLink(result.url)">
        {{ result.title || site(result.url) }}
      </button>
      <p :class="ui.meta()">{{ meta(result) }}</p>
      <p v-if="result.text" :class="ui.text()">{{ result.text }}</p>
    </li>
  </ol>
</template>
