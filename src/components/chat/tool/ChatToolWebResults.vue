<script setup lang="ts">
import { compact } from 'es-toolkit'

import type { SearchResult } from '@open-pencil/cloud/contract'
import { useI18n } from '@open-pencil/vue/i18n'

import { useDateFormat } from '@/app/i18n/date'
import { openExternalLink } from '@/app/shell/ui'

import { chatToolTheme } from './ui'

/** The pages a web search found: each title opens the page, under its site and date. */
const { results } = defineProps<{ results: SearchResult[] }>()
const { ai } = useI18n()
const dates = useDateFormat()
const ui = chatToolTheme()

function site(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '')
}

function meta(result: SearchResult): string {
  const date = result.publishedAt ? dates.format(result.publishedAt, 'date') : ''
  return compact([site(result.url), result.author, date]).join(' · ')
}
</script>

<template>
  <p v-if="results.length === 0" :class="ui.sourcesEmpty()">{{ ai.webSearchNothingFound }}</p>
  <ol v-else :class="ui.sources()" :aria-label="ai.webSearchSources">
    <li v-for="result in results" :key="result.url" :class="ui.source()">
      <button type="button" :class="ui.sourceTitle()" @click="openExternalLink(result.url)">
        {{ result.title || site(result.url) }}
      </button>
      <p :class="ui.sourceMeta()">{{ meta(result) }}</p>
      <p v-if="result.text" :class="ui.sourceText()">{{ result.text }}</p>
    </li>
  </ol>
</template>
