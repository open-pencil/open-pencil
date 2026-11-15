<script setup lang="ts">
import { AI_PROVIDERS, HARNESS_PROVIDER_ID, type AIProviderDef } from '@open-pencil/core/constants'

/**
 * The providers the AI chat offers, as the app's own catalog lists them, so the page shows what
 * the model picker does. Pi is a coding agent and Cloud's AI has a page of its own.
 */
const SEPARATE: ReadonlySet<string> = new Set([HARNESS_PROVIDER_ID, 'openpencil'])

function models(provider: AIProviderDef): string {
  const names = provider.models.map((model) => model.name)
  if (names.length === 0) return 'Any model it serves'
  if (provider.signInOnly) return `The models your plan offers, such as ${names.join(', ')}`
  return provider.supportsCustomModel
    ? `${names.join(', ')}, or any other model it serves`
    : names.join(', ')
}

const rows = AI_PROVIDERS.filter((provider) => !SEPARATE.has(provider.id))
  .toSorted((left, right) => left.name.localeCompare(right.name))
  .map((provider) => ({
    id: provider.id,
    name: provider.name,
    models: models(provider),
    keyURL: provider.keyURL || null,
    signIn: provider.signInOnly === true,
    endpoint: provider.supportsCustomBaseURL === true
  }))
</script>

<template>
  <table>
    <thead>
      <tr>
        <th scope="col">Provider</th>
        <th scope="col">Models</th>
        <th scope="col">How to connect</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.id">
        <td>
          <strong>{{ row.name }}</strong>
        </td>
        <td>{{ row.models }}</td>
        <td>
          <template v-if="row.signIn">Sign in, in the desktop app</template>
          <template v-else-if="row.endpoint">Your server's base URL and key</template>
          <a v-else-if="row.keyURL" :href="row.keyURL" target="_blank" rel="noreferrer">API key</a>
          <template v-else>API key</template>
        </td>
      </tr>
    </tbody>
  </table>
</template>
