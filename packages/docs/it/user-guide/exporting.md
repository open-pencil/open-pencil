---
title: Esportare
description: Esportare la selezione in PNG, JPG, WEBP o SVG e salvare file `.fig`.
---

# Esportare

## Esportazione di immagini

Seleziona un oggetto e apri **Esporta** nel pannello delle proprietà. Ogni impostazione definisce formato, scala o larghezza esplicita, suffisso del nome e qualità per JPG/WEBP.

Un oggetto può avere più impostazioni. L’anteprima appare su uno sfondo a scacchi per verificare la trasparenza.

Puoi anche aprire **Esporta…** dal menu contestuale.

## Copia come

Il menu contestuale copia la selezione come testo, SVG, PNG o JSX.

## Salvare documenti

**Salva** aggiorna il file corrente. **Salva con nome…** sceglie una nuova posizione. Tauri usa finestre native; Chrome ed Edge possono usare File System Access API; gli altri browser scaricano il file.

I file `.fig` esportati includono dati Kiwi, compressione Zstandard e miniatura. Componenti e insiemi vengono conservati per riaprire il file in Figma.

## Scegliere il formato

- PNG conserva la trasparenza ed è adatto alle interfacce.
- JPG riduce le dimensioni delle fotografie.
- WEBP offre una buona compressione per il Web.
- SVG mantiene vettori modificabili ed è adatto a icone e codice.
