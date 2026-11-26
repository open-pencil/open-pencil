<template>
  <!-- A picture beside the list that explains it; the list goes below on a phone. -->
  <div class="guide-legend">
    <slot />
  </div>
</template>

<style scoped>
.guide-legend {
  display: grid;
  grid-template-columns: minmax(0, 11fr) minmax(0, 9fr);
  gap: 24px;
  align-items: center;
  margin: 20px 0 24px;
}

.guide-legend :deep(.guide-image) {
  align-self: stretch;
  margin: 0;
}

.guide-legend :deep(:is(ol, ul)) {
  margin: 0;
}

@media (max-width: 640px) {
  .guide-legend {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
