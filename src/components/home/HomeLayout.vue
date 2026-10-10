<script setup lang="ts">
/**
 * The home tab: where documents come from on the side, what is there in the middle. Phones get
 * the locations as a menu above the documents instead of the sidebar.
 */
</script>

<template>
  <div class="flex min-h-0 flex-1 bg-app text-surface">
    <div class="hidden md:flex">
      <slot name="sidebar" />
    </div>
    <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
      <div class="mx-auto flex w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-5">
        <div v-if="$slots.locations" class="mb-3 md:hidden"><slot name="locations" /></div>
        <slot />
      </div>
    </main>
  </div>
</template>
