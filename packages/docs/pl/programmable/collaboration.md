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
- **Agenci:** wbudowany czat AI pojawia się jako kursor przy edytowanych warstwach, a jego obrysowana etykieta zawiera iskrę i kryptonim, na przykład *Fern*. Kursor i obrys mają kolor osoby, która go uruchomiła, więc widać, czyj to agent. Udostępniane są tylko nazwa, rodzaj, model, stan, strona, położenie i edytowane warstwy agenta, nigdy prompty ani odpowiedzi.

## Tryb śledzenia

Kliknij awatar uczestnika na górnym pasku, aby śledzić jego widok. Położenie i skala obszaru roboczego będą odpowiadać jego widokowi, a ramka w kolorze uczestnika z paskiem „Obserwujesz: …” pokazuje, kogo śledzisz. Aby przestać, kliknij awatar ponownie, naciśnij <kbd>Esc</kbd> albo sam kliknij, przewiń, zmień powiększenie lub przełącz stronę.

Awatar pokazuje liczbę agentów uruchomionych przez daną osobę. Najedź na niego, aby zobaczyć każdego agenta, jego bieżące działanie i stronę, a następnie kliknij **Obserwuj** przy agencie, aby mieć w widoku stronę i warstwy, które edytuje; śledzenie trwa między jego odpowiedziami i kończy się, gdy agent odejdzie. Przycisk za awatarami wyświetla wszystkich uczestników pokoju wraz z ich agentami i działa z klawiatury. Twój awatar wyświetla Twoich agentów — kliknij jednego, aby zmienić jego nazwę — i zawiera polecenie **Opuść pokój**.

Panel udostępniania wyświetla wszystkich uczestników pokoju wraz z ich agentami, tym, co każdy z nich robi, i stroną, na której pracuje. Agenta śledzisz tak samo: strona i warstwy, które edytuje, pozostają w widoku; śledzenie trwa między jego odpowiedziami i kończy się, gdy agent odejdzie. Kliknij dwukrotnie własnego agenta, aby zmienić jego nazwę.

## Jak to działa

Uczestnicy łączą się bezpośrednio przez WebRTC, dlatego dane dokumentu są przesyłane między przeglądarkami bez centralnego serwera.

Stan dokumentu jest synchronizowany przez Yjs CRDT, który automatycznie łączy równoczesne zmiany. IndexedDB przechowuje stan lokalny, aby można go było odtworzyć po ponownym otwarciu tego samego pokoju.

## Wskazówki

- Współpraca działa w przeglądarce i aplikacji komputerowej.
- Identyfikatory pokojów są tworzone z kryptograficznie bezpiecznych wartości losowych.
- Kursory i informacje o obecności rozłączonych uczestników są automatycznie usuwane.
