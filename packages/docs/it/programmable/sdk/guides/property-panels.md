---
title: Pannelli delle proprietà
description: Creare pannelli delle proprietà con composable e componenti elenco senza stile.
---

# Pannelli delle proprietà

`@open-pencil/vue` fornisce soprattutto composable per leggere valori dalla selezione e applicare modifiche tramite l’editor.

Usa un composable quando il pannello deve calcolare valori e offrire azioni. Usa un componente strutturale come `PropertyListRoot` per elenchi controllati di riempimenti, contorni o effetti.

## Collegamenti alle variabili

I campi compatibili con variabili devono rispettare queste regole:

- focus e apertura del selettore non rimuovono un collegamento esistente;
- la separazione avviene solo alla prima modifica reale;
- un’azione esplicita rimuove il collegamento;
- separazione, modifica e aggiornamenti su selezioni multiple appartengono a una sola operazione di cronologia.

`NumberField` può mostrare il nome della variabile quando inattivo e il valore numerico risolto durante la modifica.

## Proprietà semplici

`usePosition`, `useAppearance`, `useLayout` e `useTypography` forniscono valori misti e azioni adatte ai campi controllati.

## Proprietà in elenco

`useFillControls`, `useStrokeControls` e `useEffectsControls` si combinano con `PropertyListRoot` e `PropertyListItem`. L’applicazione decide l’aspetto delle righe e dei selettori.

## Vedi anche

- [usePosition](../api/composables/use-position)
- [useAppearance](../api/composables/use-appearance)
- [useLayout](../api/composables/use-layout)
- [useTypography](../api/composables/use-typography)
- [PropertyListRoot](../api/components/property-list-root)
