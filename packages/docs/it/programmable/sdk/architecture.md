---
title: Architettura dell'SDK
description: Struttura delle cartelle, confini dell'API pubblica e pattern di composizione in @open-pencil/vue.
---

# Architettura dell'SDK

`@open-pencil/vue` è il livello Vue sopra `@open-pencil/core`.

Non possiede il modello dell'editor stesso. Adatta l'editor core in:

- iniezione Vue
- composable reattivi
- primitive strutturali headless
- cablaggio del canvas e degli input

## Struttura delle cartelle

Questo pacchetto è organizzato per dominio.

### Famiglie di componenti

- `Canvas/`
- `ColorPicker/`
- `FillPicker/`
- `FontPicker/`
- `GradientEditor/`
- `LayerTree/`
- `PageList/`
- `PropertyList/`
- `ScrubInput/`
- `Toolbar/`

Contengono primitive strutturali/headless e helper locali.

### Controlli

`controls/` contiene composable per pannelli proprietà e controlli dell'editor:

- `usePosition`
- `useLayout`
- `useAppearance`
- `useTypography`
- `useExport`
- `useFillControls`
- `useStrokeControls`
- `useEffectsControls`
- `useNodeProps`
- `usePropScrub`

### Variabili

`VariablesEditor/` contiene composable per il dominio delle variabili e il cablaggio dello stato.

### Selezione

`selection/` contiene stato dell'editor derivato dalla selezione e le relative capacità.

### Contesto

`context/` contiene helper per l'iniezione dell'editor:

- `EDITOR_KEY`
- `provideEditor`
- `useEditor`

### Interno

`internal/` contiene utility trasversali non destinate come primitive headless principali.

## Filosofia dell'API pubblica

### Preferisci i composable

Se il problema riguarda principalmente logica di controllo, derivazione di stato o azioni dell'editor, esponi un composable.

### Riserva le primitive headless per strutture significative

Usa i root dei componenti quando coordinano struttura, figli, slot o contesto.

Esempi:

- `PageListRoot`
- `PropertyListRoot`
- `ToolbarRoot`

### Evita slot con dump di contesto ampi

Preferisci slot prop mirati o uso diretto dei composable rispetto a payload giganti `v-slot="ctx"`.

## Responsabilità App vs SDK

### L'SDK possiede

- integrazione con l'editor
- logica headless riutilizzabile
- struttura UI riutilizzabile senza assunzioni di stile
- integrazione del rendering canvas

### L'app possiede

- stile
- shell di layout
- routing
- flussi di file del prodotto
- toast, menu e UX specifica dell'app

## Regola pratica

Se un pezzo di logica potrebbe essere riutilizzato in un'app diversa basata su OpenPencil senza portare lo stile dell'app con sé, probabilmente appartiene a `@open-pencil/vue`.

## Pagine correlate

- [Per Iniziare con l'SDK](./getting-started)
- [Riferimento API](./api/)
