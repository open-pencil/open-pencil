---
title: useDocumentWorkspace
description: Manage document lists, refreshes, lazy previews, and workspace events.
---

# useDocumentWorkspace

`useDocumentWorkspace()` provides headless state for document browsers backed by local or remote storage.

It manages:

- initial, manual, focused-window, reconnect, and interval refreshes
- deduplicated refresh requests and source invalidation events
- lazy preview loading with bounded concurrency
- preview object URL creation and cleanup
- per-preview errors

## Usage

```ts
import { useDocumentWorkspace } from '@open-pencil/vue'

const workspace = useDocumentWorkspace({
  source: {
    refresh: () => documentService.list(),
    loadPreview: (id) => documentService.loadPreview(id),
    subscribe: (listener) => documentService.subscribe(listener),
  },
  refreshInterval: 60_000,
})
```

The source must return items with `id`, `name`, and `updatedAt`. A changed `updatedAt` value invalidates an existing or in-flight preview.

## Lazy previews

Apply `previewDirective` to the element that should trigger loading, then resolve the current object URL with `previewURL()`:

```vue
<script setup lang="ts">
const { documents, previewDirective: vDocumentPreview, previewURL } = workspace
</script>

<template>
  <article v-for="document in documents" :key="document.id">
    <div v-document-preview="document.id">
      <img v-if="previewURL(document.id)" :src="previewURL(document.id) ?? undefined" alt="" />
    </div>
  </article>
</template>
```

When `IntersectionObserver` is unavailable, the directive loads the preview immediately.

## Errors

`error` contains the latest document-list refresh failure. Preview failures are available by document ID through `previewErrors`; use `onPreviewError` when errors should also be reported to an application service.

```ts
const workspace = useDocumentWorkspace({
  source,
  onPreviewError(id, error) {
    reportPreviewError({ id, error })
  },
})
```

Calling `loadPreview(id)` retries a failed preview. Successful loads clear the corresponding preview error.

## Cleanup

The composable revokes generated object URLs and unsubscribes from the source when its component unmounts. Call `clearPreviews()` when switching an external workspace or provider without unmounting the component.
