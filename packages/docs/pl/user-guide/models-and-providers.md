---
pageClass: guide
title: Modele i dostawcy
description: Z jakimi dostawcami AI działa czat, co działa w przeglądarce, a co w aplikacji desktopowej, i co zrobić, gdy dostawca jest nieosiągalny.
---

<script setup>
import ModelProviders from '#docs/theme/components/ModelProviders.vue'
</script>

# Modele i dostawcy

[Czat AI](./ai-chat) korzysta z modelu, który podłączysz: [agenta programistycznego](./coding-agents), którego już masz, klucza API od dostawcy, konta [OpenPencil Cloud](/cloud/ai) albo własnego serwera. Z kluczem API albo własnym serwerem żądania trafiają prosto z aplikacji do dostawcy, a agent programistyczny korzysta z własnego połączenia. AI w OpenPencil Cloud działa przez własną usługę Cloud, która przekazuje każde żądanie do dostawcy modelu, z którego korzysta.

Dodaj model w **Ustawienia → Modele** albo pozwól, żeby zrobiła to konfiguracja z przewodnikiem. Po świeżej instalacji zalogowanie się do OpenPencil Cloud z planem, który obejmuje AI, konfiguruje wszystko samo; model, który już masz skonfigurowany, zostaje bez zmian.

Konfiguracja z przewodnikiem przypisuje też każdemu rodzajowi pracy model zalecany przez dostawcę, chyba że to, co już przypisano, nadal działa: **Agent projektowy** obsługuje czat, **Recenzja** ocenia projekty na podstawie zrzutów ekranu, **Szybkie zadania** wykonują drobne prace, takie jak nadawanie nazw czatom, a **Wizja** odczytuje obrazy. **Wizja** jest konfigurowana tylko wtedy, gdy powiesz, że chcesz pracować z obrazami. Dostawca, którego główny model nie odczytuje obrazów, na przykład DeepSeek albo Z.ai, recenzuje projekty i odczytuje obrazy, gdy o to poprosisz, jednym ze swoich modeli, który to potrafi, o ile taki ma. Każde z tych przypisań możesz zmienić w sekcji **Przypisania** w **Ustawienia → Modele**.

## Dostawcy

<ModelProviders />

**OpenAI-compatible** pasuje do większości innych usług i lokalnych serwerów i ma przełącznik między API Completions a Responses. **Anthropic-compatible** pasuje do usług, które obsługują Messages API Anthropic. Wpisz bazowy adres URL, klucz i identyfikator modelu, którego oczekuje twój serwer.

W przypadku **OpenRouter** możesz też się zalogować zamiast wklejać klucz.

**ChatGPT** korzysta z twojego planu ChatGPT zamiast klucza API, a jego odpowiedzi wliczają się do limitów planu. Jest dostępny tylko w aplikacji desktopowej. Logowanie otwiera przeglądarkę i wraca do aplikacji pod adresem `localhost:1455`, jedynym, który akceptuje OpenAI, więc najpierw zamknij uruchomione `codex login`. Logowanie odnawia się samo, a lista modeli pochodzi z twojego konta.

## W przeglądarce i w aplikacji desktopowej

Aplikacja desktopowa może połączyć się z każdym dostawcą i przechowuje klucze w systemowym magazynie poświadczeń. Oferuje też to, czego nie potrafi przeglądarka: agentów programistycznych i logowanie przez ChatGPT.

Aplikacja webowa wysyła żądania z przeglądarki, więc dostawca musi na to pozwalać (CORS). Wbudowani dostawcy na to pozwalają; w przypadku własnego serwera albo innej usługi sprawdź to, zanim zaczniesz na tym polegać.

Gdy aplikacja webowa pokazuje komunikat **„Nie udało się połączyć z tym punktem końcowym z przeglądarki”**, żądanie nie dostało odpowiedzi, którą przeglądarka by przyjęła. Albo dostawca nie pozwala na żądania z przeglądarki, albo pozwala, ale nie dołącza tego zezwolenia do odpowiedzi z błędem, więc błędny klucz albo nazwa modelu wyglądają tak samo. Wypróbuj te same ustawienia w aplikacji desktopowej: jeśli tam działają, dostawca blokuje przeglądarkę. Strona [Testing a Model Provider](/development/testing-model-providers) pokazuje, jak samodzielnie sprawdzić dostawcę.

## Wybieranie modelu

Czat działa przez wywoływanie narzędzi, więc model musi obsługiwać **wywołania narzędzi** i niezawodnie je strumieniować; modele różnią się pod tym względem nawet u tego samego dostawcy. Dodaj **wizję**, żeby czat mógł oglądać obrazy i sprawdzać własną pracę.

Modele rozumujące mogą zużyć cały budżet odpowiedzi na myślenie. Jeśli model zatrzymuje się, nic nie robiąc, zwiększ jego **Maks. tokenów wyjściowych** albo obniż **Poziom rozumowania**.

Każdy krok odpowiedzi wysyła ponownie rozmowę i opisy narzędzi, więc długie odpowiedzi zużywają dużo tokenów wejściowych. **Maksymalna liczba kroków na wiadomość** w sekcji **Czat** w **Ustawienia → Modele** ogranicza to dla wbudowanego AI, a agenci programistyczni ustawiają własne limity; zobacz [Gdy AI pracuje](./ai-chat#gdy-ai-pracuje).

## Ochrona kluczy

W przeglądarce klucze są przechowywane w zaszyfrowanej pamięci przeglądarki, żeby nie trzeba było wpisywać ich ponownie; w ustawieniach możesz zamiast tego wybrać przechowywanie ich tylko na czas sesji. Aplikacja desktopowa korzysta z systemowego magazynu poświadczeń. Klucz zapisany w przeglądarce nadal może zostać użyty przez skrypty działające na stronie, więc tam, gdzie dostawca to umożliwia, wybieraj klucze o ograniczonym zakresie i z limitem wydatków.
