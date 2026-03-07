<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import SchemaOrg from './SchemaOrg.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
</script>

<template>
  <Layout>
    <template #home-hero-after>
      <div v-if="frontmatter.layout === 'home'" class="screenshot">
        <img
          src="/screenshot.png"
          alt="OpenPencil editor with a Material 3 design file open"
        />
      </div>
    </template>
    <template #home-features-after>
      <SchemaOrg />
    </template>
  </Layout>
</template>

<style scoped>
.screenshot {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 24px;
}

.screenshot img {
  width: 100%;
  border-radius: 12px;
}
</style>
