<script setup lang="ts">
import { cloudCommunityPagePath, type CommunityDocument } from '#cloud/contract'

/**
 * The gallery's page as the server draws it for crawlers that run no script: each file with its
 * preview, description, and a link to its page. The app replaces it when it mounts.
 */
const { entries, description } = defineProps<{
  entries: { document: CommunityDocument; description: string }[]
  description: string
}>()
</script>

<template>
  <main>
    <h1>Community</h1>
    <p>{{ description }}</p>
    <ul>
      <li v-for="entry in entries" :key="entry.document.id">
        <a :href="cloudCommunityPagePath(entry.document.id)">
          <img :src="entry.document.thumbnailPath" alt="" loading="lazy" />
          <h2>{{ entry.document.name }}</h2>
        </a>
        <p>{{ entry.description }}</p>
      </li>
    </ul>
  </main>
</template>
