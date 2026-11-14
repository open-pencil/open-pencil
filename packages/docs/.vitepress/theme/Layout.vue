<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'

import SiteFooter from './footer/SiteFooter.vue'
</script>

<!-- The default layout with the site footer in place of VitePress's one-line footer. -->
<template>
  <DefaultTheme.Layout>
    <template #layout-bottom>
      <SiteFooter />
    </template>
  </DefaultTheme.Layout>
</template>
