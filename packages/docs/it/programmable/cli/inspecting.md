---
title: Esaminare file con la CLI
description: Consultare pagine, oggetti, gerarchie, variabili e formati dei documenti `.fig`.
---

# Esaminare file con la CLI

La CLI permette di capire la struttura di un file senza aprire l’editor.

```sh
bun open-pencil info design.fig
bun open-pencil pages design.fig
bun open-pencil tree design.fig
```

## Riepilogo

`info` mostra formato, versione, numero di pagine e oggetti, dimensioni dell’area di lavoro, font, variabili e metadati principali.

## Pagine e albero

`pages` elenca le pagine. `tree` stampa la gerarchia e può limitare profondità, pagina o numero di risultati.

## Cercare oggetti

`find` cerca per nome, tipo o altri criteri.

## Mostrare un oggetto

`node` mostra le proprietà dell’identificatore indicato, tra cui geometria, stile, relazioni e dati specifici del tipo.

## Variabili e formati

`variables` elenca raccolte, modalità, tipi e valori. `formats` mostra i formati registrati e le capacità di lettura e scrittura.

## Output JSON

I comandi di consultazione supportano `--json`, adatto a `jq`, CI e programmi che richiedono un output stabile e leggibile dalle macchine.

```sh
bun open-pencil pages design.fig --json | jq '.[].name'
```

Usa `bun open-pencil --help` o aggiungi `--help` a un sottocomando per vedere tutte le opzioni.
