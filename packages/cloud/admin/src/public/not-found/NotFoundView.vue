<script setup lang="ts">
import PublicShell from '#admin/components/layout/PublicShell.vue'
import RouterActionLink from '#admin/components/navigation/RouterActionLink.vue'
import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
</script>

<template>
  <PublicShell>
    <main class="grid min-h-[calc(100vh-7rem)] place-items-center p-5 text-center">
      <section>
        <p class="text-sm font-medium text-component">404</p>
        <h1 class="mt-2 text-3xl font-semibold">{{ messages.public.value.notFoundTitle }}</h1>
        <p class="mt-3 text-sm text-muted">{{ messages.public.value.notFoundDescription }}</p>
        <RouterActionLink to="/" class="mt-6" color="primary" variant="solid" size="md">
          {{ messages.public.value.backHome }}
        </RouterActionLink>
      </section>
    </main>
  </PublicShell>
</template>
