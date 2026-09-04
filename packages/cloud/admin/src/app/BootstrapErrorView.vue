<script setup lang="ts">
import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-canvas p-5 text-center">
    <section role="alert">
      <h1 class="text-lg font-semibold text-surface">
        {{ messages.errors.value.configUnavailable }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ messages.errors.value.configUnavailableDescription }}
      </p>
    </section>
  </main>
</template>
