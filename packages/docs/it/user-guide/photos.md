---
pageClass: guide
title: Foto
description: Riempi un livello con una foto stock gratuita di Unsplash o Pexels in OpenPencil.
---

# Foto

OpenPencil cerca nelle librerie di foto gratuite di [Unsplash](https://unsplash.com) e [Pexels](https://www.pexels.com) a partire dal riempimento immagine di un livello. Entrambe permettono a chiunque di usare le loro foto gratuitamente, ed entrambe richiedono una chiave API per la ricerca, anch’essa gratuita. La chiave resta sul tuo dispositivo.

Per cercare e usare le foto serve una connessione di rete al servizio in cui cerchi.

## Riempire un livello con una foto

Disegna la cornice o la forma che la foto deve riempire, poi:

1. Apri il suo riempimento e impostalo su **Immagine**.
2. Scegli **Foto stock** nell’anteprima.
3. Prima che tu scriva, il selettore mostra le scelte del servizio: il feed editoriale di Unsplash o le foto selezionate di Pexels. Scrivi ciò che cerchi, come `mountains` o `coffee`; altri risultati si caricano man mano che scorri. Passa il puntatore su una foto, o raggiungila con i tasti freccia, per vedere chi l’ha scattata.
4. Scegline una. Diventa il riempimento immagine del livello e mantiene la modalità di scala del riempimento, quindi **Fill**, **Fit**, **Crop** e **Tile** funzionano come su qualsiasi immagine.

Il pulsante del servizio nell’intestazione del selettore passa da Unsplash a Pexels e viceversa. Il selettore si apre sull’ultimo che hai usato, o su uno con una chiave quando quello non ne ha. Finché un servizio non ha una chiave, il selettore lo segnala: scegli **Apri Impostazioni**, apri il servizio in **Impostazioni → Media**, segui **Ottieni chiave API** per crearne una, incollala e scegli **Salva**. **Verifica connessione** prova la chiave che hai scritto, o quella salvata, con una sola richiesta al servizio.

Un’app Unsplash ha due chiavi: incolla la sua **Access Key**, non la Secret key. Una nuova app Unsplash consente 50 richieste all’ora finché Unsplash non la approva per la produzione; ogni ricerca, ogni pagina di risultati e ogni verifica contano.

Pexels ha sospeso il rilascio di nuove chiavi API. Se hai già una chiave Pexels, funziona ancora; altrimenti usa Unsplash.

## Crediti e chiavi

Unsplash e Pexels chiedono che le foto siano attribuite a chi le ha scattate; il selettore indica il fotografo di ogni foto. OpenPencil comunica a Unsplash quando viene usata una delle sue foto, come richiedono i termini della sua API.

Cambia o rimuovi le chiavi in **Impostazioni → Media**. Lo strumento per le foto stock della chat IA usa le stesse chiavi.
