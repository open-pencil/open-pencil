<template>
  <!-- Two captioned pictures on one backdrop, such as before and after; one above the other on a phone. -->
  <div class="guide-pair">
    <slot />
  </div>
</template>

<style scoped>
.guide-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  margin: 20px 0 24px;
  padding: 8px;
  border-radius: 12px;
  background: #dde3ec;
}

.dark .guide-pair {
  background: #3a404c;
}

.guide-pair :deep(.guide-image) {
  margin: 0;
  background: none;
}

@media (max-width: 640px) {
  .guide-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
