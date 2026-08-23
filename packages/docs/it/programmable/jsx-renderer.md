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
