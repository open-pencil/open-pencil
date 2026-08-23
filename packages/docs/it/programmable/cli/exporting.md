---
title: Esportare dalla CLI
description: Generare immagini, SVG, HTML e altri output senza aprire l’editor.
---

# Esportare dalla CLI

`export` produce il rendering di una pagina o di un oggetto da un file supportato.

```sh
bun open-pencil export design.fig -o preview.png
```

## Scegliere il contenuto

Le opzioni del comando selezionano pagina, identificatore o oggetto trovato. Il formato viene dedotto dall’estensione o indicato esplicitamente.

## Scala e dimensioni

La scala controlla la risoluzione. È possibile fissare larghezza o altezza; le proporzioni vengono mantenute quando è fornita una sola dimensione.

## SVG e HTML

SVG conserva la geometria vettoriale ed è adatto a icone, revisione e modifiche successive.

L’esportazione HTML crea un documento autonomo con struttura e stili disponibili. È pensata per consegna, ispezione ed elaborazioni successive, non come sostituto identico del rendering CanvasKit. È disponibile solo lavorando su file.

## Percorso di output

`-o` o `--output` definisce il percorso. La CLI segnala formati errati, oggetti mancanti e percorsi non validi invece di produrre risultati parziali in silenzio.

Consulta `bun open-pencil export --help` per formati e opzioni disponibili.
