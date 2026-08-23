---
title: Interfaccia di editing personalizzata
description: Creare un’interfaccia con provideEditor, CanvasRoot, menu, pannelli e barre degli strumenti.
---

# Interfaccia di editing personalizzata

Un’applicazione OpenPencil con Vue comprende normalmente tre livelli:

1. `@open-pencil/core` crea l’editor;
2. `@open-pencil/vue` lo collega a composable e componenti Vue senza stile;
3. l’applicazione definisce disposizione, stile e comportamento specifico del prodotto.

## Casi d’uso

L’applicazione OpenPencil è solo una possibile interfaccia. Il SDK permette di creare un editor integrato in un altro prodotto, uno strumento interno per risorse, un editor di modelli, un’interfaccia di annotazione o un editor specializzato assistito dall’AI.

## Struttura consigliata

Un’interfaccia tipica:

- esegue `provideEditor()` in alto nell’albero dei componenti;
- posiziona il canvas al centro;
- mostra pagine e livelli in un pannello laterale;
- mostra le proprietà nel pannello opposto;
- controlla menu e barre degli strumenti tramite composable.

## Esempio

```vue
<script setup lang="ts">
import { createEditor } from '@open-pencil/core/editor'
import {
  provideEditor,
  CanvasRoot,
  CanvasSurface,
  ToolbarRoot,
  PageListRoot,
} from '@open-pencil/vue'

const editor = createEditor({ width: 1440, height: 900 })
provideEditor(editor)
</script>

<template>
  <div class="grid h-screen grid-cols-[240px_1fr_320px] grid-rows-[48px_1fr]">
    <ToolbarRoot v-slot="{ tools, activeTool, setTool }">
      <header class="col-span-3">
        <button v-for="tool in tools" :key="tool.id" @click="setTool(tool.id)">
          {{ tool.label }}
        </button>
      </header>
    </ToolbarRoot>

    <aside><PageListRoot /></aside>
    <main><CanvasRoot><CanvasSurface class="size-full" /></CanvasRoot></main>
    <aside>Pannello proprietà</aside>
  </div>
</template>
```

## Responsabilità

- Il SDK gestisce l’integrazione con l’editor e la logica riutilizzabile.
- L’applicazione controlla disposizione, stile e azioni proprie.
- I composable forniscono i dati di menu e pannelli senza imporre ulteriori componenti contenitore.
