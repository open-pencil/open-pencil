<script setup lang="ts">
import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
</script>

<template>
  <main class="grid min-h-screen place-items-center p-6">
    <section class="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl">
      <h1 class="m-0 text-xl font-semibold text-surface">
        {{ messages.auth.value.forbiddenTitle }}
      </h1>
      <p class="mt-2 text-sm leading-6 text-muted">
        {{ messages.auth.value.forbiddenDescription }}
      </p>
      <RouterLink
        to="/"
        class="mt-5 inline-flex text-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        {{ messages.common.value.back }}
      </RouterLink>
    </section>
  </main>
</template>
