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

## Modalità app in esecuzione

Con l’app desktop in esecuzione, ometti il file: la CLI si collega tramite RPC.

```sh
openpencil documents list    # elenca gli ID di documenti e pagine aperti
openpencil tree              # esamina il documento attivo
openpencil tree --document-id tab-123 --page-id 0:1
openpencil eval --document-id tab-123 --page-id 0:1 -c "..."
```

Nei flussi di lavoro con agenti usa `openpencil documents list --json`, poi passa esplicitamente `--document-id` e `--page-id` invece di affidarti alla scheda o pagina attiva. Per aprire, salvare, cambiare e chiudere documenti, annullare, modificare le impostazioni o chiamare qualsiasi strumento dell’editor, vedi [Controllare l’app](/programmable/cli/app-control).

## Lint dei design

```sh
openpencil lint design.fig --preset strict
openpencil lint design.fig --rule color-contrast
openpencil lint design.fig --list-rules
openpencil lint design.fig --fix -o fixed.fig
```

Usa `--json` per un output leggibile dalle macchine; ogni messaggio include `fix` e `suggestions` come dati. `--fix` applica le correzioni sicure (collega i colori alla variabile di colore corrispondente e arrotonda la geometria a pixel interi) e scrive il risultato nel file `.fig` indicato con `-o`.

## Output JSON

I comandi di consultazione supportano `--json`, adatto a `jq`, CI e programmi che richiedono un output stabile e leggibile dalle macchine.

```sh
bun open-pencil pages design.fig --json | jq '.[].name'
```

Usa `bun open-pencil --help` o aggiungi `--help` a un sottocomando per vedere tutte le opzioni.
