---
title: Renderer JSX
description: Crea design con JSX — la sintassi che gli LLM già conoscono da milioni di componenti React.
---

# Renderer JSX

OpenPencil usa JSX come linguaggio di creazione dei design. Gli LLM hanno visto milioni di componenti React — descrivere un layout come `<Frame><Text>` è naturale, nessun addestramento speciale necessario. Ogni token conta quando un agente IA esegue decine di operazioni, e JSX è la rappresentazione dichiarativa più compatta.

JSX è anche confrontabile con diff. Quando un'IA modifica un design, la modifica è un diff JSX — leggibile, revisionabile, versionabile.

## Creazione dei Design

Lo strumento `render` (disponibile nella chat IA, MCP e CLI eval) accetta JSX:

```jsx
<Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text size={14} color="#666">Description text</Text>
</Frame>
```

Nel server MCP e nella chat IA, lo strumento `render` accetta direttamente stringhe JSX. Nella CLI, usa il comando `export` per andare nella direzione opposta — [esportare design come JSX](./cli/exporting).

## Elementi

Tutti i tipi di nodo sono disponibili come elementi JSX:

| Elemento | Crea | Alias |
|----------|------|-------|
| `<Frame>` | Frame (contenitore, supporta auto-layout) | `<View>` |
| `<Rectangle>` | Rettangolo | `<Rect>` |
| `<Ellipse>` | Ellisse / cerchio | |
| `<Text>` | Nodo di testo (i figli diventano contenuto testuale) | |
| `<Line>` | Linea | |
| `<Star>` | Stella | |
| `<Polygon>` | Poligono | |
| `<Vector>` | Tracciato vettoriale | |
| `<Group>` | Gruppo | |
| `<Section>` | Sezione | |

## Proprietà di Stile

Proprietà abbreviate compatte ispirate alla nomenclatura di Tailwind.

### Layout

| Proprietà | Descrizione |
|-----------|-------------|
| `flex` | `"row"` o `"col"` — attiva l'auto-layout |
| `gap` | Spazio tra i figli |
| `wrap` | Manda a capo i figli alla riga successiva |
| `rowGap` | Spaziatura sull'asse trasversale durante il wrapping |
| `justify` | `"start"`, `"end"`, `"center"`, `"between"` |
| `items` | `"start"`, `"end"`, `"center"`, `"stretch"` |
| `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl` | Padding |

### Dimensione e Posizione

| Proprietà | Descrizione |
|-----------|-------------|
| `w`, `h` | Larghezza/altezza — numero, `"fill"` o `"hug"` |
| `minW`, `maxW`, `minH`, `maxH` | Vincoli di dimensione |
| `x`, `y` | Posizione |

### Aspetto

| Proprietà | Descrizione |
|-----------|-------------|
| `bg` | Riempimento di sfondo (colore esadecimale) |
| `fill` | Alias per `bg` |
| `stroke` | Colore del bordo |
| `strokeWidth` | Larghezza del bordo (predefinito: 1) |
| `rounded` | Raggio degli angoli (o `roundedTL`, `roundedTR`, `roundedBL`, `roundedBR`) |
| `cornerSmoothing` | Angoli arrotondati stile iOS (0–1) |
| `opacity` | 0–1 |
| `shadow` | Ombra esterna (es. `"0 4 8 #00000040"`) |
| `blur` | Raggio sfocatura del livello |
| `rotate` | Rotazione in gradi |
| `blendMode` | Metodo di fusione |
| `overflow` | `"hidden"` o `"visible"` |

### Tipografia

| Proprietà | Descrizione |
|-----------|-------------|
| `size` / `fontSize` | Dimensione del font |
| `font` / `fontFamily` | Famiglia di font |
| `weight` / `fontWeight` | `"bold"`, `"medium"`, `"normal"` o numero |
| `color` | Colore del testo |
| `textAlign` | `"left"`, `"center"`, `"right"`, `"justified"` |

## Esportazione in JSX

Converti design esistenti in JSX:

```sh
open-pencil export design.fig -f jsx                   # formato OpenPencil
open-pencil export design.fig -f jsx --style tailwind  # classi Tailwind
```

Il ciclo completo funziona: esporta un design come JSX, modifica il codice, renderizzalo di nuovo.

## Confronto Visuale con Diff

Poiché i design sono rappresentabili come JSX, le modifiche diventano diff del codice:

```diff
 <Frame name="Card" w={320} flex="col" gap={16} p={24} bg="#FFF">
-  <Text size={18} weight="bold">Old Title</Text>
+  <Text size={24} weight="bold" color="#1D1B20">New Title</Text>
   <Text size={14} color="#666">Description</Text>
 </Frame>
```

Questo rende le modifiche ai design revisionabili nelle pull request, tracciabili nel controllo di versione e verificabili nella CI.
