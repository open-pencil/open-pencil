---
title: Motore JSX
description: Creare design da JSX ed esportare una selezione in JSX con Tailwind.
---

# Motore JSX

OpenPencil converte JSX dichiarativo in un albero di design. Lo stesso sistema è disponibile nella chat AI, in MCP e in `eval`.

```jsx
<Frame flex="col" gap={16} p={24} w={320} bg="#ffffff" radius={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text color="#667085">Description</Text>
</Frame>
```

Nel codice dell’applicazione o nelle librerie headless, importa `Frame`, `Text` e gli altri export di scrittura da `@open-pencil/design-jsx`, poi crea i nodi con `renderTree` o `renderJSX` da `@open-pencil/core/design-jsx`, che aggiungono icone, conversione SVG e disposizione. Per scrivere gli alberi come TSX, imposta `"jsxImportSource": "@open-pencil/design-jsx"` con `"jsx": "react-jsx"` in `tsconfig.json`, oppure aggiungi al file il commento `/** @jsxImportSource @open-pencil/design-jsx */`. L’ambiente di scripting determina quali API sono esposte a `eval`: gli export dei pacchetti non diventano automaticamente globali.

## Elementi

`Frame`, `Text`, `Rectangle`, `Ellipse` e `Image` creano i rispettivi oggetti. I componenti registrati possono generare alberi riutilizzabili definiti dall’applicazione.

## Disposizione

- `flex="row"` o `flex="col"` attiva la disposizione automatica.
- `gap` regola la spaziatura.
- `p`, `px`, `py`, `pt`, `pr`, `pb` e `pl` regolano i margini interni.
- `align`, `justify` e `wrap` controllano allineamento e ritorno a capo.

## Dimensioni e aspetto

`w` e `h` accettano numeri, `"fill"` o `"hug"`; `x` e `y` definiscono la posizione fuori dal flusso. `bg`, `fill`, `color`, `stroke`, `opacity`, `radius` e `shadow` controllano l’aspetto.

Le proprietà tipografiche come `size`, `font`, `weight`, `lineHeight` e `letterSpacing` mantengono il nome inglese perché fanno parte dell’API JSX.

## Esportare in JSX

**Copia come → JSX** converte la selezione in JSX e classi Tailwind. L’output prova a conservare gerarchia, disposizione, dimensioni, colori, tipografia e bordi come punto di partenza per l’implementazione.

Il JSX esportato può essere modificato e renderizzato di nuovo nel documento. L’esportazione scrive livelli nascosti e bloccati, vincoli, limiti di dimensione, riempimenti multipli, sfumati e immagine, contorni, effetti, maschere e collegamenti alle variabili, quindi renderizzare un export li riproduce e `diff_jsx` mostra le modifiche a ciascuno di essi. Testo formattato con stili misti, tracciati vettoriali, griglie di layout, stili condivisi e definizioni delle proprietà dei componenti non vengono ancora scritti. Le istanze sono scritte come frame con il loro contenuto, così il JSX esportato è autonomo. Vedi [esportazioni dalla CLI](./cli/exporting).
