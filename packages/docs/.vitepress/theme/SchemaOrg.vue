<script setup lang="ts">
import { useData } from 'vitepress'

const { page } = useData()

const isEnHome = page.value.relativePath === 'index.md'

const schema = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'OpenPencil',
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Windows, macOS, Linux, Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  url: 'https://app.openpencil.dev',
  description:
    'Open-source, AI-native design editor. Figma-compatible with full .fig file support.',
  softwareVersion: '0.7.0',
  license: 'https://opensource.org/licenses/MIT',
  screenshot: 'https://openpencil.dev/screenshot.png',
  downloadUrl: 'https://github.com/open-pencil/open-pencil/releases/latest',
  featureList: [
    'Open .fig files natively',
    'AI chat with 78 design tools',
    'MCP server for AI coding tools',
    'P2P real-time collaboration',
    'Headless CLI for automation',
    'Desktop app via Tauri',
  ],
})
</script>

<template>
  <component :is="'script'" v-if="isEnHome" type="application/ld+json">{{ schema }}</component>
</template>
