---
title: Collaborazione
description: Modifica P2P in tempo reale tramite WebRTC e Yjs, senza server centrale.
---

# Collaborazione

OpenPencil permette a più persone di modificare un documento in tempo reale. Le modifiche passano direttamente tra i partecipanti tramite WebRTC.

## Avviare una sessione

Apri il menu di collaborazione, crea una stanza e condividi il link. L’identificatore usa casualità crittografica e non contiene dati del documento.

## Dati condivisi

- **Documento:** forme, testo, proprietà e disposizione;
- **Presenza:** nome, colore, selezione e pagina attiva;
- **Cursori:** posizione di ogni partecipante;
- **Vista:** possibilità di seguire l’inquadratura di un’altra persona.

## Architettura

Yjs mantiene lo stato condiviso con un CRDT. Trystero individua i partecipanti e stabilisce le connessioni WebRTC. Un server di segnalazione aiuta ad avviare la connessione, ma non trasmette il documento.

Non servono account o infrastruttura propria. La qualità dipende dalla rete e dalla possibilità di stabilire WebRTC.

## Privacy

Il contenuto non viene archiviato su un server OpenPencil. Ogni partecipante conserva una copia locale. Condividi il link solo con persone fidate.

## Terminare

Alla chiusura della sessione, partecipanti remoti e cursori vengono rimossi. Le modifiche già sincronizzate restano nel documento locale.
