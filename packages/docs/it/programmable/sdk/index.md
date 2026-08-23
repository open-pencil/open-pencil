---
title: Vue SDK
description: Crea editor basati su OpenPencil con componenti senza stile e composable per Vue.
---

# Vue SDK

`@open-pencil/vue` permette di utilizzare OpenPencil non solo come applicazione di design autonoma.

Puoi integrare OpenPencil in altri prodotti, strumenti interni o editor specializzati senza adottare l'interfaccia predefinita dell'applicazione.

L’app OpenPencil è soltanto una delle interfacce realizzate con questo insieme di strumenti. L’SDK permette di crearne una personalizzata.

L'SDK fornisce:

- il contesto dell'editor tramite la dependency injection di Vue;
- il rendering dell'area di lavoro con CanvasKit;
- composable per selezione, comandi, menu, pannelli delle proprietà e variabili;
- componenti strutturali senza stile come `PageListRoot`, `PropertyListRoot` e `ToolbarRoot`;
- la localizzazione di menu, pannelli e finestre di dialogo, oltre ai componenti per selezionare la lingua.

## Da dove iniziare

<SdkCardGroup>
  <SdkCard title="Primi passi" to="/programmable/sdk/getting-started" description="Installa il pacchetto, crea un'istanza dell'editor e collega i componenti principali." />
  <SdkCard title="Architettura" to="/programmable/sdk/architecture" description="Scopri come interagiscono composable, componenti e contesto dell'editor." />
  <SdkCard title="Guide" to="/programmable/sdk/guides/custom-editor-shell" description="Crea interfacce dell'editor, pannelli delle proprietà e pannelli di navigazione personalizzati." />
  <SdkCard title="Riferimento API" to="/programmable/sdk/api/" description="Consulta i componenti, i composable e le API di basso livello." />
</SdkCardGroup>

## A cosa serve l'SDK

Prodotti e team diversi richiedono esperienze di editing diverse.

Può trattarsi di un editor di design completo, di un'area di lavoro integrata in un'altra applicazione, di uno strumento interno, di un editor di template o di un'interfaccia specializzata con funzionalità di AI.

## Principi di progettazione

- **Senza stile per scelta:** l’SDK fornisce logica e struttura senza imporre l’aspetto dell’applicazione.
- **Un composable invece di un wrapper superfluo:** se non occorre coordinare una struttura dell'interfaccia, è sufficiente un composable.
- **Un'API pubblica progettata con cura:** le funzionalità stabili vengono esportate da `packages/vue/src/index.ts`.
- **Una stretta integrazione con Vue:** l'SDK collega Vue alle funzionalità di `@open-pencil/core`.

## Due livelli di API

L'SDK è composto da due livelli principali:

1. I **composable** forniscono lo stato dell'editor e le relative operazioni.
2. I **componenti** definiscono una struttura significativa dell'interfaccia.

Se ti servono soltanto lo stato e le operazioni dell'editor, inizia dai composable. Se stai creando parti riutilizzabili dell'interfaccia, inizia dai componenti.

## Sezioni dell'API

- [Componenti](/programmable/sdk/api/components/)
- [Composable](/programmable/sdk/api/composables/)
- [API di basso livello](/programmable/sdk/api/advanced/)
