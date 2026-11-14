---
title: Analizzare documenti con la CLI
description: Individuare colori, tipografie, spaziature e strutture ripetute.
---

# Analizzare documenti con la CLI

I sottocomandi `analyze` esaminano l’intero documento e aiutano a trovare incoerenze o strutture candidate a diventare componenti.

## Colori

`analyze colors` raggruppa i colori di riempimenti e contorni, ne conta gli utilizzi e rivela tonalità quasi identiche.

## Tipografia

`analyze typography` elenca le combinazioni di famiglia, dimensione e stile con la relativa frequenza, così da individuare stili isolati.

## Spaziatura

`analyze spacing` esamina spaziature e margini interni dei frame con disposizione automatica. Rende visibile, per esempio, un valore `13px` in una scala `8/16/24`.

## Strutture ripetute

`analyze clusters` cerca gerarchie simili che potrebbero diventare componenti e mostra corrispondenza, dimensione e struttura.

## Output JSON

Aggiungi `--json` per elaborare i risultati in CI, generare report o applicare regole personalizzate.

Queste analisi non modificano il file. Per le trasformazioni usa [`eval`](./scripting).
