<script setup lang="ts">
/** The home tab: where documents come from on the side, what is there in the middle. */
</script>

<template>
  <div class="flex min-h-0 flex-1 bg-app text-surface">
    <div class="hidden md:flex">
      <slot name="sidebar" />
    </div>
    <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
      <div class="mx-auto flex w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-5">
        <slot />
      </div>
    </main>
  </div>
</template>
