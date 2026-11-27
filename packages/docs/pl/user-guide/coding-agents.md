---
pageClass: guide
title: Agenci programistyczni
description: Używaj Claude Code, Codex, Cursora lub innego agenta programistycznego, którego już masz, jako AI w aplikacji desktopowej OpenPencil.
---

# Agenci programistyczni

Aplikacja desktopowa może używać jako swojego AI agenta programistycznego, którego już masz: Claude Code, Codex, [Antigravity CLI](#antigravity), Gemini CLI, [Cursora](#cursor), [Grok Build](#grok-build) lub [Pi](#pi). Agent działa na twoim komputerze w ramach twojej subskrypcji, a OpenPencil daje mu narzędzia do pracy na płótnie.

Agenci programistyczni wymagają [aplikacji desktopowej](/pl/download): przeglądarka nie może uruchamiać programów na twoim komputerze.

## Konfigurowanie agenta

1. Zainstaluj łącznik agenta, jak pokazuje jego sekcja poniżej. Claude Code i Codex nie potrzebują żadnego innego programu.
2. Zainstaluj serwer MCP OpenPencil, który daje agentowi narzędzia do pracy na płótnie:

   ```sh
   npm install -g @open-pencil/mcp
   ```

3. Otwórz **Ustawienia → Modele → Uruchom konfigurację z przewodnikiem** i wybierz agenta w sekcji **Agenci programistyczni na tym komputerze**.
4. Sprawdź, czy agent i serwer MCP są widoczne jako zainstalowane. **Zainstaluj adapter** instaluje łącznik za ciebie.
5. Jeśli agent nie jest zalogowany, kliknij **Zaloguj się**. Konfiguracja z przewodnikiem pokazuje konto, którego używa agent, na przykład jego plan i adres e-mail.

**Narzędzia OpenPencil** pokazuje, czy agent ma dostęp do narzędzi płótna. **Sprawdź ponownie** sprawdza jeszcze raz, gdy coś zainstalujesz lub się zalogujesz.

Jeśli używasz już agenta w terminalu, może sam się skonfigurować: kliknij **Kopiuj prompt konfiguracji** na jego karcie i wklej prompt do agenta.

## Wybieranie modelu i trybu

Agent to model jak każdy inny w **Ustawienia → Modele**, więc może być **Agentem projektowym**, wykonywać **Szybkie zadania**, pisać recenzje jako **Recenzja** albo, jeśli odczytuje obrazy, być modelem **Wizja**. W **Szybkich zadaniach** agent nadaje nazwy rozmowom, ale podsumowania nadal pisze agent projektowy, a Pi nie robi żadnej z tych rzeczy. Tego samego agenta możesz dodać dwa razy z różnymi ustawieniami.

W ustawieniach agenta:

- **Model**: **Domyślny model agenta** zostawia wybór agentowi; możesz też wybrać jeden z modeli, które oferuje. Jeśli lista się nie wczyta, wybierz **Model niestandardowy…** i wpisz identyfikator modelu.
- **Poziom rozumowania**: własne poziomy agenta dla wybranego modelu, na przykład Max w Claude Code lub Ultra w Codex.
- **Tryb**: co agent może zrobić, zanim cię zapyta, pod nazwami samego agenta, na przykład Manual, Accept edits, Plan, Auto i Bypass permissions w Claude Code albo od Read-only do Full access w Codex.
- **Obrazy wejściowe**: wyłącz, gdy wybrany model nie odczytuje obrazów.

Menu obok przycisku wysyłania zmienia model, poziom rozumowania i tryb dla bieżącego czatu, od następnej wiadomości.

## Claude Code

```sh
npm install -g @agentclientprotocol/claude-agent-acp
```

Zaloguj się z poziomu konfiguracji z przewodnikiem albo uruchom `claude` i wpisz `/login`. Jeśli przeglądarka nie może przekazać logowania z powrotem, strona logowania pokazuje kod do wklejenia w konfiguracji z przewodnikiem.

## Codex

```sh
npm install -g @agentclientprotocol/codex-acp
```

Zaloguj się przez ChatGPT z poziomu konfiguracji z przewodnikiem albo uruchom `codex login`.

Starszy łącznik, `@zed-industries/codex-acp`, instaluje program o tej samej nazwie, ale nie potrafi się zalogować. Konfiguracja z przewodnikiem poprosi cię o jego usunięcie.

## Antigravity CLI {#antigravity}

Antigravity CLI to agent Google dla Gemini. Nie potrzebuje łącznika. Zainstaluj go ze [strony Antigravity](https://antigravity.google):

```sh
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

W Windows uruchom zamiast tego w PowerShell:

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

Uruchom raz `agy` i wybierz sposób logowania. Konfiguracja z przewodnikiem pokazuje go jako zainstalowany, ale nie może pokazać jego konta.

Zanim zacznie, agent czasem prosi o pozwolenie na wylistowanie własnego folderu, `~/.gemini/antigravity-cli/mcp`. Zezwól: odmowa kończy jego turę.

## Gemini CLI

```sh
npm install -g @google/gemini-cli
```

Nie potrzebuje łącznika. Uruchom raz `gemini` i wybierz sposób logowania. Osobiste konta Google nie mogą się już logować do Gemini CLI: z takimi kontami używaj [Antigravity CLI](#antigravity).

## Cursor

CLI Cursora nie potrzebuje łącznika. Zainstaluj je według [instrukcji instalacji CLI](https://cursor.com/docs/cli/installation):

```sh
curl https://cursor.com/install -fsS | bash
```

W Windows użyj polecenia PowerShell z tamtej strony. Uruchom raz `cursor-agent login`, aby się zalogować. Modele Cursora mają poziom rozumowania w nazwie.

## Grok Build

Grok Build nie potrzebuje łącznika. Zainstaluj go według [przewodnika Grok Build](https://docs.x.ai/build/overview):

```sh
curl -fsSL https://x.ai/cli/install.sh | bash
```

W Windows użyj polecenia PowerShell z tamtej strony. Uruchom raz `grok login`, aby się zalogować.

## Pi

Pi działa przez program pomocniczy OpenPencil, który wymaga Node.js 22.15 lub nowszego albo Buna. Konfiguracja z przewodnikiem instaluje go jednym kliknięciem; możesz też zainstalować go sam:

```sh
npm install -g @open-pencil/harness
```

Pi korzysta z dostawców, do których zalogowałeś się w Pi, więc nie musisz wklejać żadnego klucza. Uruchom `pi`, zaloguj się przez `/login` i wybierz domyślny model przez `/model`. Aby użyć w OpenPencil innego modelu, wpisz go jako `provider/model` w ustawieniach Pi w OpenPencil. Z kluczem [AI Gateway](https://vercel.com/ai-gateway) Pi korzysta zamiast tego z bramy.

Pi nie odczytuje obrazów. Po ponownym uruchomieniu Pi lub OpenPencil rozmowa toczy się dalej w nowej sesji Pi.

## Rozwiązywanie problemów

- **Nie znaleziono po instalacji.** Aplikacje uruchamiane z Docka lub menu Start nie widzą wszystkich folderów, które widzi terminal. OpenPencil szuka w typowych folderach npm, Buna, Volty, mise i Homebrew. Jeśli twój jest gdzie indziej, dodaj go do `PATH` powłoki logowania i uruchom ponownie OpenPencil.
- **Wymaga aktualizacji.** Wersja serwera MCP lub programu pomocniczego Pi nie pasuje do wersji aplikacji. Kliknij przycisk aktualizacji albo uruchom polecenie, które pokazuje konfiguracja z przewodnikiem, a potem **Sprawdź ponownie**.
- **Agent nie ma dostępu do narzędzi OpenPencil** albo nie może edytować płótna. Sprawdź, czy serwer MCP jest widoczny w konfiguracji z przewodnikiem jako zainstalowany i czy działa w **Ustawienia → MCP**. Codex pomija serwer OpenPencil, gdy jego własny `config.toml` zawiera serwer o nazwie `open-pencil`: usuń ten wpis.
- **Agent prosi o zalogowanie.** Kliknij **Zaloguj się** w konfiguracji z przewodnikiem albo zaloguj się własnym poleceniem agenta, a potem wyślij wiadomość ponownie.

Agent pracuje we własnym folderze w danych aplikacji OpenPencil, więc nie przejmuje ustawień projektów z twojego folderu domowego. Nadal używa jednak własnych ustawień, takich jak serwery MCP i reguły w `~/.codex` lub `~/.claude`.
