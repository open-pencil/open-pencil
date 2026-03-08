---
title: Analisi dei Design
description: Audita colori, tipografia, spaziatura e pattern ripetuti nei file .fig.
---

# Analisi dei Design

I comandi `analyze` auditano un intero design system dal terminale — trova incongruenze, estrai la palette reale, individua componenti in attesa di essere estratti.

## Colori

```sh
open-pencil analyze colors design.fig
```

Trova ogni colore nel file, conta l'utilizzo e mostra un istogramma visuale:

```
#1d1b20  ██████████████████████████████ 17155×
#49454f  ██████████████████████████████ 9814×
#ffffff  ██████████████████████████████ 8620×
#6750a4  ██████████████████████████████ 3967×
```

## Tipografia

```sh
open-pencil analyze typography design.fig
```

Elenca ogni combinazione di famiglia di font, dimensione e peso con conteggi di utilizzo. Utile per individuare stili di testo isolati che dovrebbero essere consolidati.

## Spaziatura

```sh
open-pencil analyze spacing design.fig
```

Audita i valori di gap e padding nei frame con auto-layout. Aiuta a identificare incongruenze nella scala di spaziatura — ad esempio un gap di `13px` isolato tra valori altrimenti di `8/16/24`.

## Cluster

```sh
open-pencil analyze clusters design.fig
```

Trova pattern di nodi ripetuti che potrebbero essere estratti come componenti:

```
3771× frame "container" (100% match)
     size: 40×40, structure: Frame > [Frame]

2982× instance "Checkboxes" (100% match)
     size: 48×48, structure: Instance > [Frame]
```

## Output JSON

Tutti i comandi analyze supportano `--json` per output leggibile dalle macchine:

```sh
open-pencil analyze colors design.fig --json
```

Invia tramite pipe a `jq`, usa nei controlli CI o utilizza negli script che verificano i budget dei token di design.
