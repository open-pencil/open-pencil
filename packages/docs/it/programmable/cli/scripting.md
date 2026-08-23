---
title: Scripting
description: Eseguire JavaScript con un’API compatibile con i plugin Figma per interrogare, modificare e generare design.
---

# Scripting

`openpencil eval` esegue JavaScript su un documento e fornisce un oggetto globale `figma`. È utile per modifiche in serie, ispezione, dati di test e automazione senza aprire l’interfaccia dell’editor.

## Uso di base

```sh
openpencil eval design.fig -c "return figma.currentPage.children.length"
```

`-c` accetta JavaScript. Se il codice non inizia con `return`, OpenPencil lo esegue in una funzione asincrona e restituisce l’eventuale risultato.

## Interrogare oggetti

```sh
openpencil eval design.fig -c "return figma.currentPage.findAll((n) => n.type === 'FRAME')"
```

## Modificare e salvare

`--write` o `-w` sovrascrive il file di input. `--output` o `-o` crea un altro file.

## Script da stdin

```sh
cat transform.js | openpencil eval design.fig --stdin --write
```

## Documento aperto

Ometti il percorso per eseguire lo script sul documento attivo nell’app desktop.

## Output

In un ambiente non interattivo, `eval` usa JSON per impostazione predefinita. `--json` lo forza e `--quiet` o `-q` nasconde l’output quando viene scritto solo un file.

## API compatibile

L’API segue il modello di Figma Plugin API, ma opera su SceneGraph e sui formati OpenPencil. Copre documento, pagine, creazione di oggetti, operazioni sull’albero, componenti, variabili e proprietà comuni.

Gli identificatori esatti come `figma.currentPage`, `createFrame`, `appendChild`, `fills`, `fontSize`, `layoutMode` e `strokeWeight` restano invariati.

## Limiti

Non esistono ancora equivalenti completi per `node.exportAsync()`, `node.setBoundVariable()`, `node.detachInstance()`, `figma.combineAsVariants()`, gli stili e tutte le operazioni booleane vettoriali.
