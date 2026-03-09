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
| Scorciatoia tastiera | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>E</kbd> |
| Menu contestuale | Tasto destro <kbd>→</kbd> Esporta… | Tasto destro <kbd>→</kbd> Esporta… |
| Pannello proprietà | Pulsante "Esporta" | Pulsante "Esporta" |

## Copia come

Il menu contestuale **Copia come** offre formati aggiuntivi:

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Copia come testo | — | — |
| Copia come SVG | — | — |
| Copia come PNG | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>C</kbd> |
| Copia come JSX | — | — |

## Operazioni file .fig

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Apri | <kbd>⌘</kbd><kbd>O</kbd> | <kbd>Ctrl</kbd> + <kbd>O</kbd> |
| Salva | <kbd>⌘</kbd><kbd>S</kbd> | <kbd>Ctrl</kbd> + <kbd>S</kbd> |
| Salva come | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>S</kbd> |

I file salvati sono compressi e includono una miniatura per l'anteprima nel file manager.

Compatibilità round-trip con Figma.

## Suggerimenti

- Usa scala 2× o 3× per schermi ad alta risoluzione.
- JPG usa sempre sfondo bianco — usa PNG o WEBP per la trasparenza.
- Usa l'export SVG per la modifica vettoriale in editor di codice o Illustrator.
