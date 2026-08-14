---
title: Modifica testo
description: Creare e modificare testo con formattazione rich in OpenPencil.
---
# Modifica testo

## Creare testo
Premi <kbd>T</kbd>, poi clicca sul canvas. Inizia a digitare immediatamente.

## Modifica inline
Doppio click su un nodo testo per entrare in modalità modifica. Clicca fuori per confermare.

## Navigazione cursore
| Azione | Mac | Windows / Linux |
|--------|-----|-----------------|
| Sinistra/destra | <kbd>←</kbd> / <kbd>→</kbd> | <kbd>←</kbd> / <kbd>→</kbd> |
| Su/giù | <kbd>↑</kbd> / <kbd>↓</kbd> | <kbd>↑</kbd> / <kbd>↓</kbd> |
| Per parola | <kbd>⌥</kbd><kbd>←</kbd> / <kbd>⌥</kbd><kbd>→</kbd> | <kbd>Ctrl</kbd> + <kbd>←</kbd> / <kbd>Ctrl</kbd> + <kbd>→</kbd> |
| Inizio/fine riga | <kbd>⌘</kbd><kbd>←</kbd> / <kbd>⌘</kbd><kbd>→</kbd> | <kbd>Home</kbd> / <kbd>End</kbd> |

<kbd>Shift</kbd> estende la selezione.

## Formattazione rich text
| Azione | Mac | Windows / Linux |
|--------|-----|-----------------|
| Grassetto | <kbd>⌘</kbd><kbd>B</kbd> | <kbd>Ctrl</kbd> + <kbd>B</kbd> |
| Corsivo | <kbd>⌘</kbd><kbd>I</kbd> | <kbd>Ctrl</kbd> + <kbd>I</kbd> |
| Sottolineato | <kbd>⌘</kbd><kbd>U</kbd> | <kbd>Ctrl</kbd> + <kbd>U</kbd> |

## Selettore font
Ricerca, anteprima e scroll virtuale.

## Fonti dei font
- **Font predefinito** — Inter viene caricato automaticamente
- **App desktop** — font di sistema e cataloghi abilitati di Google Fonts, Fontsource, Bunny Fonts e Fontshare
- **Browser** — font di sistema disponibili in Chrome ed Edge; i cataloghi online richiedono l’app desktop
- **Font scaricati** — l’app desktop memorizza nella cache gli stili scaricati per riutilizzarli sullo stesso dispositivo

## Font mancanti e sostituzioni

Quando una famiglia o uno stile richiesto non può essere caricato, OpenPencil mostra un avviso sopra l’editor invece di considerare silenziosamente fedele il rendering di fallback.

Espandi l’avviso per vedere ogni stile interessato e il sostituto attivo. Usa **Seleziona livelli** per individuare i nodi di testo interessati o **Riprova i font** dopo aver modificato l’accesso alla rete, il permesso per i font locali o le impostazioni dei provider. Uno stile può essere sintetizzato da un altro stile caricato della stessa famiglia; una famiglia mancante usa Inter come sostituto quando disponibile.

## Suggerimenti
- Input IME (cinese, giapponese, coreano) completamente supportato.
- La formattazione rich text si preserva nell'import/export .fig.
