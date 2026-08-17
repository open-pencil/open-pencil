---
title: Komponenty
description: Komponenty wielokrotnego użytku, instancje, nadpisania i synchronizacja w OpenPencil.
---
# Komponenty

Komponenty to elementy projektu wielokrotnego użytku. Zmiana komponentu głównego automatycznie aktualizuje jego instancje.

## Przeglądanie komponentów

Otwórz kartę **Assets** w lewym panelu, aby przeglądać komponenty lokalne i włączone biblioteki. Wyszukuj po nazwie, przełączaj widok siatki i listy oraz wstawiaj kliknięciem, klawiszem <kbd>Enter</kbd> lub przeciągnięciem na płótno. Pobrane rewizje pozostają dostępne offline.

## Tworzenie komponentu
Zaznacz ramkę lub grupę i naciśnij <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd>). Zaznaczenie staje się komponentem wielokrotnego użytku z fioletową etykietą i ikoną diamentu.

## Zestawy komponentów i warianty
<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> — łączy 2+ komponenty z fioletową przerywaną ramką.

Warianty obsługują wiele wymiarów, np. `Rozmiar=Mały`, `Stan=Hover` i `Motyw=Ciemny`, bez wymogu wszystkich kombinacji. Wariant w lewym górnym rogu jest domyślny i służy jako wariant zastępczy, gdy aktualizacja nie zawiera dokładnej kombinacji. Panel właściwości pozwala dodawać, zmieniać nazwy, porządkować i usuwać wymiary oraz wartości; duplikaty kombinacji są odrzucane.

## Właściwości komponentu

Komponenty obsługują właściwości tekstu, widoczności logicznej i zamiany instancji. Powiąż właściwość z polem potomnym, a następnie zmień jej wartość w instancji bez odłączania. Definicje i przypisania są zachowywane w plikach `.fig`.

## Biblioteki komponentów

Biblioteka publikuje komponenty jako niezmienną rewizję. Otwórz **Assets → Zarządzaj bibliotekami → Opublikuj bibliotekę**, przy pierwszej publikacji ustaw stabilny identyfikator i nazwę, wybierz zmiany i opublikuj. Niewybrane zmiany pozostają oczekujące.

Włącz bibliotekę w **Zarządzaj bibliotekami**. Jej zasoby pojawią się obok komponentów lokalnych. Opublikowane definicje są tylko do odczytu w dokumencie korzystającym z biblioteki, ale powiązane instancje i nadpisania pozostają edytowalne.

W sekcji **Aktualizacje** porównaj obok siebie bieżącą i nową instancję. Zaktualizuj jedną instancję, wszystkie instancje danego zasobu, bieżącą stronę lub wszystkie strony. Zgodne właściwości są zachowywane, a brak dokładnego wariantu pokazuje wariant zastępczy przed zatwierdzeniem. Aktualizacje można cofać i ponawiać.

Biblioteki mogą korzystać z katalogu lokalnego lub skonfigurowanego dostawcy przechowywania danych. Pobrane rewizje są przechowywane w pamięci podręcznej. Włączone powiązania i zmaterializowane definicje są zapisywane w `.fig`, więc dokument można ponownie otworzyć bez dostępu do biblioteki zdalnej.

## Tworzenie instancji
Prawy przycisk → **Utwórz instancję**. Pojawia się 40 px na prawo.

## Odłączanie instancji
<kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> — staje się ramką bez powiązania.

## Synchronizacja na żywo
Edycja komponentu aktualizuje wszystkie instancje. Synchronizowane: wymiary, wypełnienia, obrysy, efekty, przezroczystość, promienie narożników, layout.

## Nadpisania
Instancje mogą nadpisywać wybrane właściwości bez zrywania powiązania z komponentem głównym. Nadpisana właściwość jest pomijana podczas synchronizacji — pozostałe właściwości nadal aktualizują się z komponentu.

## Hit testing
Kliknięcie zaznacza komponent. **Dwuklik** aby wejść i zaznaczyć dzieci.

## Wygląd

| Element | Wygląd |
|---------|--------|
| Etykieta komponentu | Fioletowa z ikoną diamentu |
| Etykieta instancji | Fioletowa z ikoną diamentu |
| Ramka zestawu | Fioletowa przerywana ramka |

## Skróty klawiszowe

| Akcja | Mac | Windows / Linux |
|-------|-----|-----------------|
| Utwórz komponent | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd> |
| Utwórz zestaw | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd> |
| Odłącz instancję | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd> |
