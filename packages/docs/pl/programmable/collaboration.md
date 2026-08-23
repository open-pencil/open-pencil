---
title: Współpraca
description: Jednoczesna edycja bezpośrednio między uczestnikami przez WebRTC, bez osobnego serwera i konta.
---

# Współpraca

Kilka osób może jednocześnie edytować jeden dokument. Uczestnicy łączą się bezpośrednio, dlatego centralny serwer nie przekazuje danych, a konto nie jest wymagane.

## Udostępnianie pokoju

1. Kliknij przycisk „Udostępnij” w prawym górnym rogu.
2. Skopiuj odnośnik `app.openpencil.dev/share/<room-id>`.
3. Wyślij go innym uczestnikom.

Dołączyć może każda osoba znająca odnośnik. Pokój pozostaje dostępny, dopóki co najmniej jeden uczestnik ma otwartą stronę.

## Synchronizowane dane

- **Dokument:** figury, tekst, właściwości i układ są aktualizowane po każdej zmianie.
- **Kursory:** widoczne są położenie, nazwa i kolor każdego uczestnika.
- **Zaznaczenie:** obiekty wybrane przez innych są widoczne dla wszystkich.

## Tryb śledzenia

Kliknij awatar uczestnika na górnym pasku, aby śledzić jego widok. Położenie i skala obszaru roboczego będą odpowiadać jego widokowi. Ponowne kliknięcie wyłącza śledzenie.

## Jak to działa

Uczestnicy łączą się bezpośrednio przez WebRTC, dlatego dane dokumentu są przesyłane między przeglądarkami bez centralnego serwera.

Stan dokumentu jest synchronizowany przez Yjs CRDT, który automatycznie łączy równoczesne zmiany. IndexedDB przechowuje stan lokalny, aby można go było odtworzyć po ponownym otwarciu tego samego pokoju.

## Wskazówki

- Współpraca działa w przeglądarce i aplikacji komputerowej.
- Identyfikatory pokojów są tworzone z kryptograficznie bezpiecznych wartości losowych.
- Kursory i informacje o obecności rozłączonych uczestników są automatycznie usuwane.
