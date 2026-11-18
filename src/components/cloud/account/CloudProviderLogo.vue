<script setup lang="ts">
import type { Component } from 'vue'
import IconApple from '~icons/ai/apple'
import IconGithub from '~icons/ai/github'
import IconGoogle from '~icons/ai/google'

import type { CloudSocialProvider } from '@open-pencil/cloud/contract'

/** A sign-in provider's mark, drawn in `currentColor`: the one place a new provider's logo goes. */
const { provider } = defineProps<{ provider: CloudSocialProvider }>()

const LOGOS: Record<CloudSocialProvider, Component> = {
  google: IconGoogle,
  apple: IconApple,
  github: IconGithub
}
</script>

<template>
  <component :is="LOGOS[provider]" />
</template>
