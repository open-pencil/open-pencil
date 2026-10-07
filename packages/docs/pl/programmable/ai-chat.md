---
title: Czat AI
description: Wbudowany asystent z ponad 90 narzędziami do tworzenia i zmieniania projektów.
---

# Czat AI

Naciśnij <kbd>⌘</kbd><kbd>J</kbd> albo <kbd>Ctrl</kbd> + <kbd>J</kbd>. Asystent tworzy figury, zmienia style i układ, pracuje z komponentami oraz analizuje dokument.

## Konfiguracja

Przy pierwszym uruchomieniu konfiguracja z przewodnikiem pyta, w czym ma pomagać AI i z czego już korzystasz: z agenta programistycznego, takiego jak Claude Code, Codex lub Gemini CLI w aplikacji na komputer, z konta API albo z serwera lokalnego lub firmowego. Łączy ten dostęp i przypisuje go do ról **Design agent** i **Vision**, nie zmieniając ręcznej konfiguracji. W przypadku OpenRouter wystarczy się zalogować zamiast wklejać klucz API. Możesz ją pominąć i uruchomić ponownie w **Ustawienia → AI i agenci → Uruchom konfigurację z przewodnikiem**. Aby skonfigurować modele ręcznie:

1. Otwórz panel czatu AI.
2. Kliknij ikonę ustawień.
3. Dodaj model i skonfiguruj dostawcę, identyfikator modelu, dane uwierzytelniające oraz możliwości.
4. Zapisz model i przypisz go do roli **Design agent**.

Możesz utworzyć kilka modeli i osobno przypisać je do projektowania, przeglądu, szybkich zadań oraz przetwarzania obrazów. Modele korzystające z tego samego połączenia dostawcy używają wspólnych zapisanych danych uwierzytelniających.

### Dostawcy

| Dostawca | Modele | Konfiguracja |
|----------|--------|--------------|
| **OpenRouter** | Claude, GPT, Gemini, DeepSeek, Qwen i inne | Klucz API z [openrouter.ai](https://openrouter.ai) |
| **Anthropic** | Claude Sonnet 4.6, Claude Opus 4.6 | Klucz API z [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | GPT-5.3 Codex, GPT-4.1, o3, o4-mini | Klucz API z [platform.openai.com](https://platform.openai.com) |
| **Google AI** | Gemini 3.1 Pro, Gemini 3 Flash | Klucz API z [aistudio.google.dev](https://aistudio.google.dev) |
| **Z.ai** | GLM-5.1, GLM-5, GLM-4.7 i rodzina GLM-4.5 | Klucz API zgodnie z [dokumentacją Z.ai](https://docs.z.ai/devpack/quick-start) |
| **MiniMax** | MiniMax M3, M2.7, M2.7-highspeed, M2.5, M2.1 | Klucz API z [platform.minimax.io](https://platform.minimax.io/user-center/basic-information/interface-key) |
| **Zgodny z OpenAI** | Dowolny punkt końcowy w formacie OpenAI API | Własny adres bazowy i klucz; wybór Completions API lub Responses API |
| **Zgodny z Anthropic** | Dowolny punkt końcowy w formacie Anthropic API | Własny adres bazowy i klucz |

OpenPencil nie wymaga osobnego serwera ani subskrypcji: żądania są wysyłane bezpośrednio do dostawcy. W przeglądarce podlegają jego zasadom CORS. Poszczególne wdrożenia modeli różnią się niezawodnością przesyłania wywołań narzędzi. Wyniki pomiarów znajdują się na stronie [Zgodność dostawców i modeli BYOK](/programmable/byok-provider-compatibility).

### Zewnętrzne połączenia MCP

W wersji komputerowej agenci ACP mogą korzystać z zaufanych zdalnych serwerów [Model Context Protocol](https://modelcontextprotocol.io/). Otwórz **Ustawienia → Połączenia MCP**, dodaj nazwany punkt końcowy Streamable HTTP, opcjonalnie zapisz token Bearer i włącz połączenie.

Token jest przechowywany w skonfigurowanym magazynie danych uwierzytelniających i odczytywany dopiero podczas uruchamiania sesji ACP.

Zdalny serwer musi używać HTTPS. W lokalnym środowisku programistycznym dozwolone są adresy pętli zwrotnej przez HTTP. Włączaj wyłącznie zaufane serwery. Wbudowany serwer MCP OpenPencil jest podłączany automatycznie.

## Możliwości

Asystent korzysta z ponad 90 narzędzi do tworzenia, stylizowania, układu, komponentów, zmiennych, wyszukiwania, inspekcji, analizy, eksportu i operacji wektorowych. Do inspekcji należą `get_jsx` (widok JSX w obie strony), `diff_create` i `diff_jsx` (różnice strukturalne), `diff_visual` (różnice pikseli) oraz `describe` (rola semantyczna i wykrywanie problemów projektowych).

## Kontrola wizualna

Po utworzeniu lub zmianie projektu asystent może wywołać `export_image`, uzyskać obraz wyniku i porównać go z pierwotnym poleceniem. Pozwala to wykryć problemy z układem, brakujące elementy i nieprawidłowe kolory. Domyślnie włączone `diff_visual` porównuje zmieniony obiekt z kopią wzorcową i zwraca zmienione piksele oraz obszar, dzięki czemu asystent może sprawdzić, że zmiana nie wyszła poza cel.

## Wskazówki

- Przed wysłaniem polecenia zaznacz odpowiednie obiekty: asystent widzi zaznaczenie.
- Dokładnie podawaj kolory, rozmiary i położenie.
- Jedna wiadomość może zmienić kilka obiektów.
- Podczas odpowiedzi możesz przeglądać inne strony: asystent dalej pracuje na stronie, na której zaczęła się wiadomość, a jego podglądy pojawią się po powrocie. Gdy jesteś na innej stronie, czat pokazuje, nad którą pracuje asystent, i udostępnia przycisk **Przejdź do strony**. Jeśli asystent sam zmieni stronę, widok podąża za nim.
- Wszystkie zmiany AI można cofnąć.
- Po każdym wywołaniu narzędzia układ jest przeliczany automatycznie.
