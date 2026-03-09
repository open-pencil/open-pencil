---
title: Scripting
description: Esegui JavaScript con la Figma Plugin API — interroga nodi, modifica design in batch, crea frame.
---

# Scripting

`open-pencil eval` ti dà accesso alla Figma Plugin API completa dal terminale. Leggi nodi, modifica proprietà, crea forme — poi scrivi le modifiche nel file.

## Utilizzo Base

```sh
open-pencil eval design.fig -c "figma.currentPage.children.length"
```

Il flag `-c` accetta JavaScript. La variabile globale `figma` funziona come la Figma Plugin API.

## Interrogazione dei Nodi

```sh
open-pencil eval design.fig -c "
  figma.currentPage.findAll(n => n.type === 'FRAME' && n.name.includes('Button'))
    .map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height }))
"
```

## Modifica e Salvataggio

```sh
open-pencil eval design.fig -c "
  figma.currentPage.children.forEach(n => n.opacity = 0.5)
" -w
```

`-w` scrive le modifiche nel file di input. Usa `-o output.fig` per scrivere in un file diverso.

## Lettura da Stdin

Per script più lunghi:

```sh
cat transform.js | open-pencil eval design.fig --stdin -w
```

## Modalità App in Esecuzione

Ometti il file per eseguire sull'app desktop in esecuzione:

```sh
open-pencil eval -c "figma.currentPage.name"
```

## API Disponibili

L'oggetto `figma` supporta:

- `figma.currentPage` — la pagina attiva
- `figma.root` — la radice del documento
- `figma.createFrame()`, `figma.createRectangle()`, `figma.createEllipse()`, `figma.createText()`, ecc.
- `.findAll()`, `.findOne()` — cerca tra i discendenti
- `.appendChild()`, `.insertChild()` — manipolazione dell'albero
- Tutti i setter di proprietà: `.fills`, `.strokes`, `.effects`, `.opacity`, `.cornerRadius`, `.layoutMode`, `.itemSpacing`, ecc.

Questa è la stessa API utilizzata dai plugin Figma, quindi le conoscenze esistenti e gli snippet di codice si trasferiscono direttamente.

## Output JSON

```sh
open-pencil eval design.fig -c "..." --json
```
