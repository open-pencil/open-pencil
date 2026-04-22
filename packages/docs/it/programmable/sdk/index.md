---
title: Vue SDK
description: Crea editor basati su OpenPencil con composable Vue headless e primitive.
---

# Vue SDK

`@open-pencil/vue` esiste affinché OpenPencil possa essere più di una semplice app di design autonoma.

L'obiettivo è rendere OpenPencil un toolkit che puoi integrare in altri prodotti, strumenti interni ed editor specifici per flussi di lavoro — non solo un'unica interfaccia predefinita.

L'app OpenPencil è una composizione di quel toolkit. L'SDK è il modo in cui ne costruisci una diversa.

Ti fornisce:

- contesto dell'editor iniettato
- rendering canvas basato su CanvasKit
- composable per selezione, comandi, menu, pannello proprietà e variabili
- primitive strutturali headless come `PageListRoot`, `PropertyListRoot` e `ToolbarRoot`
- primitive i18n integrate per menu, pannelli, dialoghi e selettori di lingua personalizzati

## Inizia da qui

<SdkCardGroup>
  <SdkCard title="Per Iniziare" to="/programmable/sdk/getting-started" description="Installa il pacchetto, crea un'istanza dell'editor e monta le primitive principali." />
  <SdkCard title="Architettura" to="/programmable/sdk/architecture" description="Scopri come composable, primitive e contesto dell'editor si integrano." />
  <SdkCard title="Guide" to="/programmable/sdk/guides/custom-editor-shell" description="Crea shell personalizzate, pannelli proprietà e pannelli di navigazione." />
  <SdkCard title="Riferimento API" to="/programmable/sdk/api/" description="Esplora componenti, composable e API avanzate." />
</SdkCardGroup>

## Perché esiste l'SDK

Prodotti e team diversi hanno bisogno di superfici di editing diverse.

A volte vuoi un editor di design completo. A volte vuoi un canvas integrato in un'altra app. A volte vuoi uno strumento interno, un editor di template, o una superficie di editing assistita dall'IA costruita attorno a un caso d'uso specifico.

L'SDK è il livello che rende possibile tutto ciò.

## Principi di design

- **Headless first**: logica e struttura, non stile applicativo
- **Composable anziché wrapper**: usa i composable quando non c'è coordinamento strutturale significativo
- **API pubblica intenzionale**: export stabili da `packages/vue/src/index.ts`
- **Framework-aware**: integrazione Vue su `@open-pencil/core`

## Come pensare al pacchetto

L'SDK ha due livelli principali:

1. **Composable** per lo stato e le azioni dell'editor
2. **Primitive** per struttura UI significativa

Se hai bisogno solo dello stato e delle azioni dell'editor, inizia con i composable.
Se stai costruendo blocchi UI riutilizzabili per l'editor, inizia con le primitive.

## Sezioni API

- [Componenti](/programmable/sdk/api/components/)
- [Composable](/programmable/sdk/api/composables/)
- [Avanzato](/programmable/sdk/api/advanced/)
