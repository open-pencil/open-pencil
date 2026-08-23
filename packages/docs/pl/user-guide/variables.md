---
title: Zmienne
description: Zmienne projektu, kolekcje, tryby i powiązania kolorów w OpenPencil.
---

# Zmienne

Zmienne przechowują tokeny projektu przeznaczone do ponownego użycia: kolory, odstępy i inne wartości, które można powiązać z obiektami. Po zmianie zmiennej wszystkie powiązane obiekty zostają zaktualizowane.

## Otwieranie edytora zmiennych

Usuń zaznaczenie ze wszystkich obiektów. Karta „Projekt” pokaże właściwości strony, w tym sekcję „Zmienne”. Kliknij ikonę ustawień, aby otworzyć okno.

## Kolekcje

Zmienne są łączone w kolekcje. Każda kolekcja jest przedstawiona jako osobna karta.

- Kliknij kartę, aby przejść do kolekcji.
- Kliknij jej nazwę dwukrotnie, aby ją zmienić.

## Tryby

Kolekcja może zawierać kilka trybów, na przykład Light i Dark. W tabeli każdy tryb zajmuje osobną kolumnę, a zmienna przechowuje wartość dla każdego trybu.

### Dodawanie kolekcji i trybów

Nową kolekcję tworzy się z paska narzędzi okna. Dodawaj tryby, aby przechowywać warianty motywu albo wartości dla różnych punktów przełamania układu.

## Praca ze zmiennymi

Tabela zawiera kolumnę „Nazwa” o zmiennej szerokości oraz po jednej kolumnie dla każdego trybu.

- **Utwórz:** kliknij **Utwórz zmienną**.
- **Zmień nazwę:** kliknij komórkę z nazwą.
- **Zmień wartość:** kliknij komórkę odpowiedniego trybu.
- **Wyszukaj:** wpisz część nazwy w polu wyszukiwania.

### Zmienne kolorów

Dla zmiennej koloru tabela pokazuje pole koloru. Kliknij próbkę, aby otworzyć wybór koloru.

Typy `FLOAT`, `STRING` i `BOOLEAN` istnieją w modelu danych, ale nie mają jeszcze pełnego interfejsu edycji.

## Powiązania zalewów i obwiedni

W panelu właściwości otwórz sekcję „Zalew” albo „Obwiednia” i wybierz zmienną koloru.

- Wybierz zmienną, aby utworzyć powiązanie. Obok właściwości pojawi się fioletowa etykieta z jej nazwą.
- Usuń powiązanie za pomocą osobnego działania w oknie wyboru. Bieżąca obliczona wartość zostanie zachowana.

Otwarcie pola lub okna wyboru nie zmienia powiązania. Może ono zostać usunięte tylko przez jawne działanie albo faktyczną zmianę wartości — zależnie od zachowania elementu sterującego.

## Wskazówki

- Łącz powiązane tokeny w kolekcje, na przykład `Primitives` dla kolorów źródłowych, `Semantic` dla tokenów znaczeniowych i `Spacing` dla odstępów.
- Wartości Light i Dark jednego motywu wygodnie przechowywać jako tryby jednej kolekcji.
- Zmienne obsługują aliasy: zmienna z `Semantic` może odwoływać się do wartości z `Primitives`.
- Zalewy i wybór koloru opisano na stronie [Kształty](./drawing-shapes).
