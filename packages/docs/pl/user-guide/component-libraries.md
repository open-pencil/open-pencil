---
pageClass: guide
title: Biblioteki komponentów
description: Publikuj komponenty, style i zmienne z jednego pliku, używaj ich w innych i pobieraj ich aktualizacje.
---

# Biblioteki komponentów

Biblioteka udostępnia komponenty, style i zmienne jednego pliku twoim pozostałym plikom. Każda publikacja zapisuje nową wersję. Pliki, które korzystają z biblioteki, same decydują, kiedy ją pobrać.

## Publikowanie biblioteki

1. Otwórz plik z komponentami, które chcesz udostępnić.
2. Otwórz **Zasoby**, a potem kliknij **Zarządzaj bibliotekami** obok pola wyszukiwania.
3. Kliknij **Publikuj bibliotekę**.
4. Za pierwszym razem nadaj bibliotece identyfikator i nazwę. Identyfikatora nie da się później zmienić.
5. Zaznacz zmiany do opublikowania i, jeśli chcesz, dodaj opis.
6. Kliknij **Publikuj bibliotekę**.

<GuideImage name="component-libraries/publish" alt="Publikowanie biblioteki z identyfikatorem acme-ui, nazwą Acme UI i zaznaczonym komponentem Button" />

Biblioteka zawsze zawiera wszystkie style i kolekcje zmiennych z pliku. Zmiany, których nie zaznaczysz, poczekają na następny raz.

## Korzystanie z biblioteki

1. W pliku, który jej potrzebuje, otwórz **Zasoby → Zarządzaj bibliotekami**.
2. Włącz bibliotekę w **Przeglądaj biblioteki**.
3. Umieszczaj jej komponenty z **Zasobów** tak samo jak własne.

Komponent przynosi ze sobą style i zmienne, których używa. Nie można ich tu edytować: zmień je w pliku biblioteki i opublikuj ponownie. Instancje pozostają edytowalne jak wszystkie inne.

## Aktualizowanie do nowej wersji

Otwórz **Zarządzaj bibliotekami → Aktualizacje**, żeby zobaczyć, co się zmieniło. Nic w twoim pliku się nie zmieni, dopóki tego nie wybierzesz.

1. Porównaj instancję przed aktualizacją i po niej.
2. Zaktualizuj zaznaczoną instancję, wszystkie instancje danego komponentu, instancje na tej stronie albo wszystkie naraz.

Instancje zachowują zmiany, które w nich wprowadzono, także w warstwach, których nazwy biblioteka zmieniła. Tracą tylko zmiany w warstwach, które biblioteka usunęła. Jeśli wariantu instancji nie ma już w nowej wersji, przegląd podaje, którego wariantu użyje w zamian. **Cofnij** wycofuje aktualizację.

## Gdzie są przechowywane biblioteki

Biblioteki z grupy **Lokalny** zostają w tej przeglądarce albo aplikacji. Biblioteki z grupy **Przechowywanie** znajdują się w skonfigurowanym przez ciebie [zasobniku zgodnym z S3](./cloud-storage), więc mogą z nich korzystać inne osoby. Przełączasz się między nimi u góry **Przeglądaj biblioteki**.

Wersje, których już używasz, są przechowywane na twoim komputerze, więc ich komponenty nadal się wyświetlają i można je umieszczać bez połączenia z internetem. Plik zapisuje wersje bibliotek, których używa, i otwiera się tak samo, nawet gdy biblioteka jest niedostępna.
