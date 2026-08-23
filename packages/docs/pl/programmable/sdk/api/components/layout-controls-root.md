---
title: LayoutControlsRoot
description: Komponent bez narzuconego wyglądu dla automatycznego układu i trybów rozmiaru.
---

<script setup lang="ts">
import { data } from '#docs-api/components/layout-controls-root.data'
</script>

# LayoutControlsRoot

`LayoutControlsRoot` przekazuje przez slot API zwracane przez `useLayout()`.

Aplikacja może wyrenderować własny panel automatycznego układu i rozmiarów, korzystając ze stanu i działań SDK.

<SdkComponentAPI :components="data.components" />

## Zobacz też

- [useLayout](../composables/use-layout)
- [Panele właściwości](../../guides/property-panels)
