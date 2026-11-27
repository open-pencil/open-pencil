---
pageClass: guide
title: Zdjęcia
description: Wypełnij warstwę darmowym zdjęciem stockowym z Unsplash lub Pexels w OpenPencil.
---

# Zdjęcia

OpenPencil przeszukuje darmowe biblioteki zdjęć [Unsplash](https://unsplash.com) i [Pexels](https://www.pexels.com) z poziomu wypełnienia obrazem warstwy. Oba serwisy pozwalają każdemu korzystać ze zdjęć za darmo i oba wymagają do wyszukiwania klucza API, który także jest darmowy. Klucz zostaje na Twoim urządzeniu.

Wyszukiwanie i używanie zdjęć wymaga połączenia z serwisem, który przeszukujesz.

## Wypełnianie warstwy zdjęciem

Narysuj ramkę lub kształt, który ma wypełnić zdjęcie, a następnie:

1. Otwórz jego wypełnienie i przełącz je na **Obraz**.
2. W podglądzie wybierz **Zdjęcie stockowe**.
3. Zanim zaczniesz pisać, okno pokazuje propozycje samego serwisu: redakcyjny wybór Unsplash albo wyselekcjonowane zdjęcia Pexels. Wpisz, czego szukasz, na przykład `mountains` albo `coffee`; kolejne wyniki doczytują się podczas przewijania. Najedź na zdjęcie albo przejdź do niego strzałkami, aby zobaczyć, kto je zrobił.
4. Wybierz zdjęcie. Stanie się wypełnieniem obrazem warstwy i zachowa tryb skalowania wypełnienia, więc **Fill**, **Fit**, **Crop** i **Tile** działają na nim jak na każdym obrazie.

Przycisk serwisu w nagłówku okna przełącza między Unsplash i Pexels. Okno otwiera się na serwisie, którego używałeś ostatnio, albo na tym, który ma klucz, jeśli ostatni go nie ma. Dopóki serwis nie ma klucza, okno o tym informuje: wybierz **Otwórz Ustawienia**, otwórz serwis w **Ustawienia → Media**, przejdź do **Pobierz klucz API**, aby go utworzyć, wklej go i wybierz **Zapisz**. **Testuj połączenie** sprawdza wpisany klucz albo zapisany, wysyłając jedno żądanie do serwisu.

Aplikacja Unsplash ma dwa klucze: wklej jej **Access Key**, a nie Secret key. Nowa aplikacja Unsplash pozwala na 50 żądań na godzinę, dopóki Unsplash nie zatwierdzi jej do użytku produkcyjnego; liczy się każde wyszukiwanie, każda strona wyników i każdy test.

Pexels wstrzymał wydawanie nowych kluczy API. Jeśli masz już klucz Pexels, nadal działa; w przeciwnym razie korzystaj z Unsplash.

## Autorzy i klucze

Unsplash i Pexels proszą, aby podpisywać zdjęcia nazwiskami ich autorów; okno wyboru podaje autora każdego zdjęcia. OpenPencil powiadamia Unsplash, gdy używasz jednego z jego zdjęć, tak jak wymagają tego warunki jego API.

Klucze zmienisz lub usuniesz w **Ustawienia → Media**. Narzędzie zdjęć stockowych w czacie AI używa tych samych kluczy.
