---
title: Czat AI
description: Wbudowany asystent z ponad 90 narzędziami do tworzenia i zmieniania projektów.
---

# Czat AI

Naciśnij <kbd>⌘</kbd><kbd>J</kbd> albo <kbd>Ctrl</kbd> + <kbd>J</kbd>. Asystent tworzy figury, zmienia style i układ, pracuje z komponentami oraz analizuje dokument.

## Konfiguracja

Przy pierwszym uruchomieniu konfiguracja z przewodnikiem pyta, w czym ma pomagać AI i z czego już korzystasz: z agenta programistycznego, takiego jak Claude Code, Codex, Antigravity CLI, Gemini CLI, Cursor lub Grok Build w aplikacji na komputer, z konta API albo z serwera lokalnego lub firmowego. Łączy ten dostęp i przypisuje go do ról **Design agent** i **Vision**, nie zmieniając ręcznej konfiguracji. W przypadku OpenRouter wystarczy się zalogować zamiast wklejać klucz API. Możesz ją pominąć i uruchomić ponownie w **Ustawienia → AI i agenci → Uruchom konfigurację z przewodnikiem**. Aby skonfigurować modele ręcznie:

1. Otwórz panel czatu AI.
2. Kliknij ikonę ustawień.
3. Dodaj model i skonfiguruj dostawcę, identyfikator modelu, dane uwierzytelniające oraz możliwości.
4. Zapisz model i przypisz go do roli **Design agent**.

Możesz utworzyć kilka modeli i osobno przypisać je do projektowania, przeglądu, szybkich zadań oraz przetwarzania obrazów. Modele korzystające z tego samego połączenia dostawcy używają wspólnych zapisanych danych uwierzytelniających.

### Dostawcy

Czat działa z OpenRouter, Anthropic, OpenAI, Google AI, DeepSeek, Z.ai, MiniMax, Twoim planem ChatGPT, dowolnym serwerem zgodnym z OpenAI lub Anthropic oraz Twoim kontem [OpenPencil Cloud](/cloud/ai). Na stronie [Modele i dostawcy](/user-guide/models-and-providers) znajdziesz modele każdego dostawcy i sposób jego podłączenia, informacje o tym, co działa w przeglądarce, oraz wskazówki dotyczące wyboru modelu.

### Zewnętrzne połączenia MCP

W wersji komputerowej agenci ACP mogą korzystać z zaufanych zdalnych serwerów [Model Context Protocol](https://modelcontextprotocol.io/). Otwórz **Ustawienia → Połączenia MCP**, dodaj nazwany punkt końcowy Streamable HTTP, opcjonalnie zapisz token Bearer i włącz połączenie.

Token jest przechowywany w skonfigurowanym magazynie danych uwierzytelniających i odczytywany dopiero podczas uruchamiania sesji ACP.

Zdalny serwer musi używać HTTPS. W lokalnym środowisku programistycznym dozwolone są adresy pętli zwrotnej przez HTTP. Włączaj wyłącznie zaufane serwery. Wbudowany serwer MCP OpenPencil jest podłączany automatycznie.

## Możliwości

Asystent korzysta z ponad 90 narzędzi do tworzenia, stylizowania, układu, komponentów, zmiennych, wyszukiwania, inspekcji, analizy, eksportu i operacji wektorowych. Do inspekcji należą `get_jsx` (widok JSX w obie strony), `diff_nodes` (różnice strukturalne), `diff_pixels` (różnice pikseli) oraz `describe` (rola semantyczna i wykrywanie problemów projektowych).

## Umiejętności

Umiejętności to foldery z plikiem `SKILL.md` w formacie [Agent Skills](https://agentskills.io/specification): instrukcje do określonego rodzaju pracy z opcjonalnymi plikami pomocniczymi. Wbudowane AI widzi nazwę i opis każdej włączonej umiejętności i wczytuje jej instrukcje, gdy prośba pasuje; skrypty z umiejętności nie są uruchamiane.

W **Ustawienia → Umiejętności** prześlij umiejętność jako ZIP jej folderu lub jako `SKILL.md`. W aplikacji desktopowej odczytywane są też `~/.agents/skills` i `~/.claude/skills` oraz foldery `.agents/skills` i `.claude/skills` obok otwartego dokumentu, używane dopiero po **Zaufaj folderowi**. Wpisz `/` na początku wiadomości, aby wybrać umiejętność, i `@`, aby wspomnieć warstwę, stronę lub umiejętność. Wzmianki pojawiają się jako chipy, także w odpowiedziach; kliknięcie pokazuje warstwę na płótnie.

## Kontrola wizualna

Po utworzeniu lub zmianie projektu asystent może wywołać `export_image`, uzyskać obraz wyniku i porównać go z pierwotnym poleceniem. Pozwala to wykryć problemy z układem, brakujące elementy i nieprawidłowe kolory. Domyślnie włączone `diff_pixels` porównuje zmieniony obiekt z kopią wzorcową i zwraca zmienione piksele oraz obszar, dzięki czemu asystent może sprawdzić, że zmiana nie wyszła poza cel.

## Wskazówki

- Przed wysłaniem polecenia zaznacz odpowiednie obiekty: asystent widzi zaznaczenie.
- Dokładnie podawaj kolory, rozmiary i położenie.
- Jedna wiadomość może zmienić kilka obiektów.
- Podczas odpowiedzi możesz przeglądać inne strony: asystent dalej pracuje na stronie, na której zaczęła się wiadomość, a jego podglądy pojawią się po powrocie. Gdy jesteś na innej stronie, czat pokazuje, nad którą pracuje asystent, i udostępnia przycisk **Przejdź do strony**. Jeśli asystent sam zmieni stronę, widok podąża za nim.
- Wszystkie zmiany AI można cofnąć.
- Po każdym wywołaniu narzędzia układ jest przeliczany automatycznie.
