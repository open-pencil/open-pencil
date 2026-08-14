---
title: Czat AI
description: Wbudowany asystent AI z ponad 90 narzędziami do tworzenia i modyfikowania projektów.
---

# Czat AI

Naciśnij <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd> + <kbd>J</kbd>), aby otworzyć asystenta AI. Opisz, czego potrzebujesz — tworzy kształty, ustawia style, zarządza układem, pracuje z komponentami i analizuje projekt.

## Konfiguracja

1. Otwórz panel czatu AI (<kbd>⌘</kbd><kbd>J</kbd>)
2. Kliknij ikonę ustawień
3. Wybierz dostawcę i wprowadź klucz API
4. Wybierz model

### Obsługiwani dostawcy

| Dostawca | Modele | Konfiguracja |
|----------|--------|--------------|
| **OpenRouter** | Claude, GPT-4, Gemini, DeepSeek i inne | Klucz API z [openrouter.ai](https://openrouter.ai) |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus itp. | Klucz API z [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | GPT-4o, GPT-4 itp. | Klucz API z [platform.openai.com](https://platform.openai.com) |
| **Google AI** | Gemini 2.0, Gemini 1.5 itp. | Klucz API z [aistudio.google.dev](https://aistudio.google.dev) |
| **Kompatybilny z OpenAI** | Dowolny endpoint w formacie API OpenAI | Własny bazowy URL + klucz. Obsługuje przełączanie między API Completions i Responses. |
| **Kompatybilny z Anthropic** | Dowolny endpoint w formacie API Anthropic | Własny bazowy URL + klucz |

Bez backendu i subskrypcji — klucz komunikuje się bezpośrednio z dostawcą. Żądania z przeglądarki podlegają zasadom CORS dostawcy, a niezawodność strumieniowych wywołań narzędzi zależy od wdrożenia modelu. Zobacz anglojęzyczną stronę [zgodności dostawców i modeli BYOK](/programmable/byok-provider-compatibility), aby poznać zmierzone wyniki i odtwarzalne testy.

## Funkcje

Asystent ma ponad 90 narzędzi w tych kategoriach:

- **Tworzenie** — ramki, kształty, tekst, komponenty, strony. Renderowanie JSX dla złożonych układów.
- **Styl** — wypełnienia, obrysy, efekty, przezroczystość, promień narożników, tryby mieszania.
- **Układ** — auto-layout, siatka, wyrównanie, odstępy, wymiarowanie.
- **Komponenty** — tworzenie komponentów, instancji, zestawów komponentów. Zarządzanie nadpisaniami.
- **Zmienne** — tworzenie/edycja zmiennych, kolekcji, trybów. Powiązanie z wypełnieniami.
- **Zapytania** — wyszukiwanie węzłów, selektory XPath, odczyt właściwości, listowanie stron, czcionek, zaznaczenia.
- **Inspekcja** — `get_jsx` dla widoku JSX, `diff_jsx` dla porównań strukturalnych, `describe` dla roli semantycznej i problemów projektowych.
- **Analiza** — paleta kolorów, audyt typografii, spójność odstępów, wykrywanie wzorców.
- **Eksport** — PNG, SVG, JSX z klasami Tailwind. Weryfikacja wizualna przez `export_image`.
- **Wektor** — operacje boolowskie, manipulacja ścieżkami.

## Weryfikacja wizualna

Asystent może wizualnie weryfikować swoją pracę. Po utworzeniu lub zmodyfikowaniu projektów używa `export_image`, aby przechwycić obraz i sprawdzić wynik z pierwotnym żądaniem.

## Przykładowe prompty

- „Utwórz kartę z tytułem, opisem i niebieskim przyciskiem"
- „Ustaw ten sam promień narożników dla wszystkich przycisków na tej stronie"
- „Jakie czcionki są używane w tym pliku?"
- „Zmień tło wybranej ramki na gradient od niebieskiego do fioletowego"
- „Eksportuj wybraną ramkę jako SVG"
- „Pokaż mi JSX tego frame'a"

## Wskazówki

- Zaznacz węzły przed zadaniem pytania — asystent wie, co jest zaznaczone.
- Podawaj dokładne kolory, rozmiary i pozycje, aby uzyskać precyzyjne wyniki.
- Asystent może modyfikować wiele węzłów w jednej wiadomości.
- Użyj „cofnij" w edytorze — mutacje AI obsługują pełne cofanie.
- Wszystkie układy są automatycznie przeliczane po każdym wykonaniu narzędzia.
