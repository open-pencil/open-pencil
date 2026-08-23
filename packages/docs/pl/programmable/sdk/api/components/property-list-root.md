---
title: PropertyListRoot
description: Kontrolowana lista zalewów, obwiedni, efektów i innych właściwości tablicowych.
---

<script setup lang="ts">
import { data } from '#docs-api/components/property-list.data'
</script>

# PropertyListRoot

`PropertyListRoot` koordynuje interfejs właściwości przechowywanych jako tablica. Otrzymuje elementy i mieszany stan przez właściwości komponentu, emituje zmiany, a przez slot udostępnia działania dodawania, usuwania, zastępowania, częściowej aktualizacji i zmiany widoczności.

```vue
<script setup lang="ts">
import { PropertyListRoot, useEditorPropertyList } from '@open-pencil/vue'
const fills = useEditorPropertyList('fills')
</script>

<template>
  <PropertyListRoot
    prop-key="fills"
    :items="fills.items.value"
    :mixed="fills.isMixed.value"
    @add="fills.actions.add"
    @remove="fills.actions.remove"
  />
</template>
```

<SdkComponentAPI :components="data.components" />
