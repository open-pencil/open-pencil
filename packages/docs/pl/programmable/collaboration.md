---
title: Współpraca
description: Jednoczesna edycja bezpośrednio między uczestnikami przez WebRTC, bez osobnego serwera i konta.
---

# Współpraca

Kilka osób może jednocześnie edytować jeden dokument. Uczestnicy łączą się bezpośrednio, dlatego centralny serwer nie przekazuje danych, a konto nie jest wymagane.

## Udostępnianie pokoju

1. Kliknij przycisk „Udostępnij” w prawym górnym rogu.
2. Kliknij **Udostępnij ten plik** — odnośnik `app.openpencil.dev/share/<room-id>` zostanie skopiowany.
3. Wyślij go innym uczestnikom.

Tylko udostępnienie umieszcza dokument w pokoju: karta, z której udostępniasz, staje się kartą pokoju i pozostaje powiązana ze swoim plikiem. Dołączyć może każda osoba znająca odnośnik.

## Dołączanie do pokoju

Otwórz odnośnik albo wklej go (lub sam identyfikator pokoju) w polu **Dołącz** w panelu udostępniania lub w **Dołącz do pokoju…** na ekranie startowym. Pokój otwiera się we własnej karcie, więc dokumenty, które masz już otwarte, się nie zmieniają. Na komputerze przeglądarka oferuje też **Otwórz w aplikacji na komputer**, co otwiera pokój w OpenPencil przez odnośnik `openpencil://join`.

Dołączasz od razu pod wygenerowaną nazwą, na przykład *Teal Fox*. Własną nazwę ustawisz w panelu udostępniania lub w ustawieniach; będzie używana w każdym pokoju.

Pokoje nie są przechowywane na serwerze: plik znajduje się na urządzeniach osób, które były w pokoju, więc karta pokoju otwiera dokument tylko wtedy, gdy któraś z nich jest online. Do tego czasu karta informuje, że czeka, wyjaśnia, dlaczego i otwiera plik, gdy tylko dołączy ktoś, kto go ma. Pokój, w którym już byłeś, otwiera się od razu z kopii na tym urządzeniu, a Twoje zmiany synchronizują się, gdy inni wrócą.

**Opuść pokój** w panelu udostępniania kończy Twój udział w pokoju. Karta, która udostępniła swój dokument, znów staje się tym dokumentem; karta, która dołączyła, zachowuje plik pokoju jako lokalną, niezapisaną kopię, którą możesz zapisać. Każda karta pokoju ma własne połączenie, więc możesz być w kilku pokojach jednocześnie.

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

Stan dokumentu jest synchronizowany przez Yjs CRDT, który automatycznie łączy równoczesne zmiany.

Przenoszenie i zmiana kolejności warstw również się scalają. Każda warstwa pamięta każdego rodzica, do którego została przeniesiona, i swoje miejsce wśród rodzeństwa, a każdy uczestnik wyznacza z tej historii to samo drzewo warstw ([CRDT drzewa Evana Wallace’a](https://madebyevan.com/algos/crdt-mutable-tree-hierarchy/)). Przeniesienia, zmiany kolejności i nowe warstwy od różnych osób są stosowane; jeśli dwie osoby jednocześnie przeniosą tę samą warstwę, u wszystkich wygrywa to samo przeniesienie. Gdy równoczesne przeniesienia umieściłyby dwie warstwy jedna w drugiej, późniejsze przeniesienie jest cofane, a warstwa, której nowy rodzic został w międzyczasie usunięty, wraca na swoje miejsce.

Wszyscy w pokoju potrzebują wersji OpenPencil, która zapisuje drzewo warstw w ten sam sposób; wersje zapisujące je inaczej nie widzą nawzajem swoich pokojów.

IndexedDB przechowuje stan lokalny: po odświeżeniu strony automatycznie wracasz do pokoju z tym samym stanem.

## Wskazówki

- Współpraca działa w przeglądarce i aplikacji komputerowej.
- Identyfikatory pokojów są tworzone z kryptograficznie bezpiecznych wartości losowych.
- Kursory i informacje o obecności rozłączonych uczestników są automatycznie usuwane.
