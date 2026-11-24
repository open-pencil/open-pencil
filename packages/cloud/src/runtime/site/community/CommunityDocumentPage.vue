<script setup lang="ts">
import { CLOUD_COMMUNITY_PATH, cloudCommunityPath, type CommunityDocument } from '#cloud/contract'

/**
 * A community file's page as the server draws it for crawlers that run no script: its preview,
 * how to open it, and its named versions. The app replaces it when it mounts.
 */
const { document, description } = defineProps<{
  document: CommunityDocument
  description: string
}>()
</script>

<template>
  <main>
    <h1>{{ document.name }}</h1>
    <p>{{ description }}</p>
    <img :src="document.thumbnailPath" :alt="document.name" />
    <p><a :href="cloudCommunityPath(document.id)">Open in OpenPencil</a></p>
    <section v-if="document.versions.length > 0">
      <h2>Versions</h2>
      <ul>
        <li v-for="version in document.versions" :key="version.id">
          <time :datetime="version.createdAt">{{ version.name }}</time>
          <p v-if="version.description">{{ version.description }}</p>
        </li>
      </ul>
    </section>
    <p><a :href="CLOUD_COMMUNITY_PATH">All community files</a></p>
  </main>
</template>
