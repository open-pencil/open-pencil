<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'

import OpenAppButton from './site/OpenAppButton.vue'
import SiteFooter from './site/SiteFooter.vue'
</script>

<!-- The default layout with the editor as the header's button, and the site footer in place of
     VitePress's one-line footer. -->
<template>
  <DefaultTheme.Layout>
    <template #nav-bar-content-after>
      <OpenAppButton place="bar" />
    </template>
    <template #nav-screen-content-after>
      <OpenAppButton place="screen" />
    </template>
    <template #layout-bottom>
      <SiteFooter />
    </template>
  </DefaultTheme.Layout>
</template>
