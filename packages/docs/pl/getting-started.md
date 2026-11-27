---
pageClass: guide
title: Rozpoczęcie pracy
description: Otwórz OpenPencil w przeglądarce lub na komputerze, poznaj edytor i zrób pierwszy projekt.
---

# Rozpoczęcie pracy

OpenPencil to edytor do projektowania ekranów, od jednego przycisku po całą aplikację. Otwiera i zapisuje pliki Figma, a działa w przeglądarce lub jako aplikacja desktopowa.

## Otwieranie OpenPencil

- **W przeglądarce:** wejdź na [cloud.openpencil.dev](https://cloud.openpencil.dev). Nie musisz niczego instalować.
- **Na komputerze:** pobierz aplikację na macOS, Windows lub Linuksa ze [strony pobierania](/pl/download). Na Macu możesz ją też zainstalować przez Homebrew: `brew install --cask openpencil`.

::: tip Przeniesiono z app.openpencil.dev
Aplikacja webowa przeniosła się na cloud.openpencil.dev. Pliki zapisane w przeglądarce pod adresem [app.openpencil.dev](https://app.openpencil.dev) zostaną tam, dopóki ten adres nie zacznie przekierowywać: otwórz go, aby zapisać je w Cloud lub pobrać.
:::

## Wymagania systemowe

W przeglądarce OpenPencil wymaga Chrome lub Edge 111, Firefoksa 128 albo Safari 16.4 lub nowszych. Przeglądarki oparte na Chrome, takie jak Brave i Opera, działają od tych samych wersji.

Aplikacja desktopowa wymaga:

- **macOS** 13 Ventura lub nowszego, z zainstalowanymi aktualizacjami Safari.
- **Windows** 10 lub nowszego, ze środowiskiem Microsoft Edge WebView2, które Windows aktualizuje samodzielnie.
- **Linuksa** z WebKitGTK 2.40 lub nowszym (`webkit2gtk-4.1`).

Jeśli przeglądarka lub system są za stare, OpenPencil podpowie, co zaktualizować. Jeśli ten komunikat pojawi się w systemie spełniającym te wymagania, kliknij w nim **Zgłoś problem**.

## Poznawanie edytora

<GuideImage name="getting-started/editor" alt="Edytor z ośmioma ponumerowanymi obszarami" />

1. **Menu.** Plik, Edycja, Widok i pozostałe, pod nazwą pliku.
2. **Strony.** Każda strona to osobne płótno w tym samym pliku.
3. **Warstwy.** Wszystko, co jest na stronie, w kolejności rysowania.
4. **Płótno.** Tu projektujesz.
5. **Pasek narzędzi.** Narzędzia do ramek, kształtów, pióra i tekstu.
6. **Panel Design.** Ustawienia zaznaczonego elementu. Karty obok **Design** pokazują go jako kod, otwierają czat AI i sprawdzają projekt pod kątem problemów.
7. **Powiększenie.** Kliknij wartość procentową, aby zobaczyć opcje powiększenia.
8. **Udostępnij i Podgląd.** Zaproś innych do pliku albo wypróbuj projekt jako prototyp.

## Tworzenie pierwszego projektu

1. Naciśnij <Keys mac="F" other="F" /> i przeciągnij po płótnie, aby narysować ramkę. Ramki mieszczą resztę projektu, na przykład ekran lub kartę.
2. Naciśnij <Keys mac="R" other="R" /> i przeciągnij wewnątrz ramki, aby narysować prostokąt.
3. Naciśnij <Keys mac="T" other="T" />, kliknij wewnątrz ramki i zacznij pisać.
4. Naciśnij <Keys mac="Esc" other="Esc" />, aby zakończyć pisanie. Panel Design pokazuje teraz czcionkę i rozmiar tekstu.
5. Naciśnij <Keys mac="⌘ S" other="Ctrl S" />, aby zapisać.

Strona [Otwieranie i zapisywanie](./user-guide/files) wyjaśnia, gdzie trafia twój plik.

## Szukanie polecenia

Naciśnij <Keys mac="⌘ K" other="Ctrl K" /> i wpisz, co chcesz zrobić, na przykład „wyrównaj do lewej” albo „eksport”. Wybierz wynik, aby go wykonać. Możesz też wpisać nazwę strony, aby do niej przejść.

## Praca na telefonie lub tablecie

Na małym ekranie panele przenoszą się do szuflady na dole. Jej przyciski otwierają warstwy, panel Design, kod i czat AI.

## Co dalej

- [Nawigacja po płótnie](./user-guide/canvas-navigation): przesuwanie widoku i powiększanie.
- [Zaznaczanie i edycja](./user-guide/selection-and-manipulation): zaznaczanie, przesuwanie i zmiana rozmiaru warstw.
- [Warstwy i strony](./user-guide/layers-and-pages): porządkowanie zawartości pliku.
- [Auto-layout](./user-guide/auto-layout): ramki, które dopasowują rozmiar do zawartości.

Chcesz samodzielnie zbudować OpenPencil? Zobacz [Contributing](/development/contributing#build-from-source).
