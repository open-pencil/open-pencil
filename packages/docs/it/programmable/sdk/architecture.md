---
title: Architettura dell'SDK
description: Struttura del pacchetto, confini dell'API pubblica e principi di progettazione di @open-pencil/vue.
---

# Architettura dell'SDK

`@open-pencil/vue` collega `@open-pencil/core` a Vue.

Il modello dell’editor rimane nel nucleo. Questo pacchetto aggiunge:

- la dependency injection con Vue;
- composable reattivi;
- componenti strutturali senza stile;
- il collegamento dell'area di lavoro e la gestione dell'input.

## Struttura del pacchetto

Il codice è organizzato per aree funzionali.

### Famiglie di componenti

- `Canvas/`
- `ColorPicker/`
- `FillPicker/`
- `FontPicker/`
- `GradientEditor/`
- `LayerTree/`
- `PageList/`
- `PropertyList/`
- `PropertySection/`
- `SegmentedControl/`
- `NumberField/`
- `Toolbar/`

Queste cartelle contengono componenti strutturali senza stile e funzioni di supporto specifiche di ciascuna area.

### Controls

`controls/` contiene i composable per i pannelli delle proprietà e i controlli dell'editor:

- `usePosition`
- `useLayout`
- `useAppearance`
- `useColorModel`
- `useTypography`
- `useExport`
- `useFillControls`
- `useStrokeControls`
- `useEffectsControls`
- `useNodeProps`
- `usePropScrub`
- `useEditorPropertyList`

### Variables

`VariablesEditor/` contiene i composable e il codice che collega lo stato dell'editor delle variabili a Vue.

### Selezione

`selection/` contiene lo stato calcolato a partire dalla selezione e le informazioni sulle operazioni disponibili.

### Contesto

`context/` contiene la chiave e le funzioni che forniscono l’editor tramite l’iniezione delle dipendenze di Vue:

- `EDITOR_KEY`
- `provideEditor`
- `useEditor`

### Internal

`internal/` contiene funzioni di supporto condivise. Non fanno parte dei principali componenti pubblici del pacchetto.

## Principi dell'API pubblica

### Composable per logica e stato

Se il codice serve principalmente a calcolare o gestire lo stato, oppure a eseguire operazioni dell'editor, esponilo come composable.

### Componenti senza stile solo quando la struttura è significativa

Un componente radice è utile quando coordina struttura, elementi figli, spazi o contesto.

Esempi:

- `PageListRoot`
- `PropertyListRoot`
- `PropertySectionRoot`
- `SegmentedControlRoot`
- `ToolbarRoot`

### Non passare l’intero contesto attraverso un solo spazio

Passa allo spazio soltanto le proprietà necessarie oppure usa direttamente il composable. I componenti controllati, come `PropertyListRoot`, emettono eventi semantici. Il collegamento con selezione e cronologia deve risiedere in un adattatore o composable di controllo, non nel componente stesso.

## Responsabilità dell'applicazione e dell'SDK

### SDK

- integrazione con l'editor;
- logica riutilizzabile senza stile;
- struttura dell'interfaccia riutilizzabile e indipendente dallo stile;
- integrazione con il rendering dell'area di lavoro.

### Applicazione

- stile;
- disposizione generale;
- routing;
- apertura, salvataggio e altre operazioni sui file;
- notifiche, menu e comportamento specifico dell'applicazione.

## Regola generale

Se del codice può essere riutilizzato in un altro editor basato su OpenPencil senza trascinare con sé lo stile dell'applicazione, probabilmente dovrebbe far parte di `@open-pencil/vue`.

## Vedi anche

- [Primi passi con l'SDK](./getting-started)
- [Riferimento API](./api/)
