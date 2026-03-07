---
title: Esportazione
description: Esportare immagini (PNG, JPG, WEBP, SVG) e gestire file .fig in OpenPencil.
---
# Esportazione

## Esportazione immagini

Seleziona un nodo e usa la sezione Export nel pannello proprietà.

### Impostazioni di esportazione

- **Scala** — 0,5×, 0,75×, 1×, 1,5×, 2×, 3× o 4× (nascosta per SVG — i vettori sono indipendenti dalla risoluzione)
- **Formato** — PNG (sfondo trasparente), JPG (sfondo bianco), WEBP (sfondo trasparente), SVG (vettore)

### Metodi di esportazione

| Metodo | Mac | Windows / Linux |
|--------|-----|-----------------|
| Scorciatoia tastiera | ⇧ ⌘ E | Shift + Ctrl + E |
| Menu contestuale | Tasto destro → Esporta… | Tasto destro → Esporta… |
| Pannello proprietà | Pulsante "Esporta" | Pulsante "Esporta" |

## Copia come

Il menu contestuale **Copia come** offre formati aggiuntivi:

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Copia come testo | — | — |
| Copia come SVG | — | — |
| Copia come PNG | ⇧ ⌘ C | Shift + Ctrl + C |
| Copia come JSX | — | — |

## Operazioni file .fig

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Apri | ⌘ O | Ctrl + O |
| Salva | ⌘ S | Ctrl + S |
| Salva come | ⇧ ⌘ S | Shift + Ctrl + S |

Compatibilità round-trip con Figma.

## Suggerimenti

- Usa scala 2× o 3× per schermi ad alta risoluzione.
- JPG usa sempre sfondo bianco — usa PNG o WEBP per la trasparenza.
- Usa l'export SVG per la modifica vettoriale in editor di codice o Illustrator.
