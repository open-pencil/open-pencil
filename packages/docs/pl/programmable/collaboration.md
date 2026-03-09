---
title: Współpraca
description: Wspólna edycja w czasie rzeczywistym przez P2P WebRTC — bez serwera, bez konta.
---

# Współpraca

Edytujcie projekty razem w czasie rzeczywistym. Uczestnicy łączą się bezpośrednio — żaden serwer nie przekazuje Twoich danych, konto nie jest wymagane.

## Udostępnianie pokoju

1. Kliknij przycisk udostępniania w prawym górnym rogu
2. Skopiuj wygenerowany link (`app.openpencil.dev/share/<room-id>`)
3. Wyślij go swoim współpracownikom

Każdy z linkiem może dołączyć. Pokój pozostaje aktywny, dopóki przynajmniej jeden uczestnik ma otwartą stronę.

## Co się synchronizuje

- **Zmiany w dokumencie** — każda edycja (kształty, tekst, właściwości, layout) synchronizuje się natychmiast
- **Kursory** — widzisz, gdzie wskazuje każdy współpracownik, wraz z imieniem i kolorem
- **Zaznaczenia** — podświetlone zaznaczenia są widoczne dla wszystkich

## Tryb śledzenia

Kliknij awatar współpracownika na górnym pasku, aby śledzić jego widok. Twoje płótno przesuwa się i przybliża zgodnie z jego widokiem. Kliknij ponownie, aby przestać śledzić.

## Jak to działa

Uczestnicy łączą się bezpośrednio przez WebRTC — Twoje dane projektowe trafiają prosto z przeglądarki do przeglądarki, nigdy przez centralny serwer. Stan dokumentu wykorzystuje CRDT (bezkonfliktowy replikowany typ danych), więc równoczesne edycje łączą się automatycznie bez konfliktów.

Pokój jest przechowywany lokalnie — jeśli odświeżysz stronę, dołączysz ponownie z tym samym stanem.

## Wskazówki

- Działa w przeglądarce i w aplikacji desktopowej
- Identyfikatory pokojów są kryptograficznie losowe — tylko osoby z linkiem mogą dołączyć
- Nieaktywne kursory są automatycznie usuwane po rozłączeniu uczestnika
