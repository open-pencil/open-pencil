---
title: Componenti
description: Componenti riutilizzabili, istanze, insiemi, sostituzioni e librerie.
---

# Componenti

I componenti sono oggetti riutilizzabili. Le modifiche al componente principale si propagano automaticamente alle istanze.

## Esplorare e inserire

La scheda **Risorse** mostra componenti locali e librerie abilitate. Permette ricerca e viste griglia o elenco. Inserisci un componente con un clic, <kbd>Enter</kbd> o trascinandolo nell’area di lavoro. Le revisioni scaricate restano disponibili offline.

## Creare un componente

Seleziona un frame o gruppo e premi <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>; su Windows e Linux, <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>K</kbd>.

## Creare un’istanza

Seleziona il componente e scegli **Crea istanza**, oppure inseriscilo da Risorse. L’istanza mantiene un collegamento al componente principale.

## Sostituzioni

Le proprietà modificate in un’istanza vengono salvate come sostituzioni. Le modifiche successive al componente principale continuano ad arrivare, tranne per le proprietà sostituite.

## Proprietà del componente

Sono supportati testo, visibilità booleana, scambio di istanza e varianti. Le proprietà appaiono a destra quando è selezionata un’istanza.

## Insiemi e varianti

Combina i componenti con <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> o <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>K</kbd>. Ogni dimensione, per esempio stato o dimensione, può avere più valori. OpenPencil supporta combinazioni sparse, impedisce duplicati e usa come predefinita la variante in alto a sinistra.

## Sincronizzazione

Le modifiche al componente principale vengono mostrate in una revisione prima dell’applicazione. Le sostituzioni restano intatte. **Vai al componente principale** funziona tra pagine e **Scollega istanza** la converte in un frame indipendente.

## Librerie

Pubblica i componenti locali come libreria e abilita librerie esterne in Risorse. Le revisioni vengono conservate localmente per lavorare offline.
