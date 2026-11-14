---
title: AppearanceControlsRoot
description: Komponent bez narzuconego wyglądu dla przezroczystości, widoczności i promienia narożników.
---

<script setup lang="ts">
import { data } from '#docs-api/components/appearance-controls-root.data'
</script>

# AppearanceControlsRoot

`AppearanceControlsRoot` przekazuje przez slot stan i działania `useAppearance()`.

Aplikacja może zbudować własne pola przezroczystości, widoczności i promienia narożników bez ponownego implementowania logiki edytora.

<SdkComponentAPI :components="data.components" />

## Zobacz też

- [useAppearance](../composables/use-appearance)
- [Panele właściwości](../../guides/property-panels)
