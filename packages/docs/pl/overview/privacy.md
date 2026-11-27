---
title: Prywatność
description: Co OpenPencil wysyła przez sieć, dlaczego wysyła anonimowe statystyki użycia i jak wyłączyć każdą z tych rzeczy.
---

<script setup>
import {
  describeBuildFields,
  describePingFields,
  describeReportFields,
  describeUsageEvents
} from '@open-pencil/feedback/contract'

const columns = [
  { key: 'name', label: 'Field', kind: 'code' },
  { key: 'values', label: 'Values', kind: 'description' }
]

function rows(fields, freeForm = 'A version number') {
  return fields.map((field) => ({
    name: field.name,
    description: field.description,
    values: field.values.length > 0 ? field.values.join(', ') : freeForm
  }))
}

const pingRows = rows(describePingFields())
const buildFields = describeBuildFields()
  .map((field) => field.name)
  .join(', ')
const events = describeUsageEvents()
const reportRows = rows(describeReportFields(), 'Free-form')
</script>

# Prywatność

- Twoje projekty, nazwy plików, nazwy warstw, teksty, prompty i klucze nigdy nie opuszczają urządzenia, chyba że sam je udostępnisz lub zsynchronizujesz albo dołączysz projekt do wysyłanego zgłoszenia.
- Oficjalne wersje wysyłają raz dziennie jeden anonimowy ping, bez identyfikatora. Możesz go wyłączyć.
- Szczegółowe statystyki użycia są wysyłane tylko wtedy, gdy się na to zgodzisz, i w każdej chwili możesz z tego zrezygnować.

## Dlaczego w ogóle zbieramy dane

OpenPencil tworzy mały zespół. Musimy wiedzieć, z jakich platform, formatów plików i funkcji korzystają ludzie, żeby zdecydować, co zbudować w następnej kolejności. Musimy też pokazać, że OpenPencil jest używany, bo od tego zależy finansowanie projektu. Liczba aktywnych instalacji i obraz tego, które funkcje są ważne, odpowiadają na oba pytania bez wiedzy o tobie i twojej pracy.

## Codzienny ping

Raz dziennie oficjalna wersja wysyła to na `feedback.openpencil.dev`:

```http
POST https://feedback.openpencil.dev/ping

{ "version": "0.17.0", "platform": "macos", "arch": "arm64", "app": "desktop", "browser": "unknown", "usageStats": "denied", "pingDays": "5-8", "enteredStep": false }
```

<SdkDataTable :columns="columns" :rows="pingRows" />

Ping nie zawiera identyfikatora, więc pingów z tej samej instalacji nie da się ze sobą powiązać. Odpowiedź na pytanie o statystyki użycia to jedyny sposób, by dowiedzieć się, ile osób odmawia, bo odmowa oznacza, że nic innego nigdy nie zostanie wysłane. Aplikacja przechowuje tylko datę ostatniego pingu, żeby pingować raz dziennie, oraz liczbę dni, w które pingowała. Wysyłany jest tylko przedział, w który ta liczba wpada: 1, 2, 3–4, 5–8 i tak dalej, za każdym razem dwa razy większy, nigdy sama liczba. Każda instalacja przechodzi przez przedziały po kolei, więc serwer odróżnia powracające instalacje od kopii jednego zapisanego stanu uruchamianych raz za razem, które powtarzają ten sam przedział, i nie musi przy tym odróżniać instalacji od siebie. Serwer zwiększa o jeden licznik dla danego dnia i wersji oraz licznik dla danego dnia, aplikacji i przedziału. Zwiększa też licznik dla danego dnia, aplikacji i platformy oraz sieci, z której przyszedł ping: numeru sieci i nazwy operatora, tak jak podaje je Cloudflare, na przykład domowego dostawcy internetu, uczelni albo dostawcy chmury. Pozwala to odróżnić prawdziwych ludzi od automatycznych instalacji działających w centrach danych, bez niczego, co identyfikuje urządzenie. Serwer nie przechowuje niczego więcej. Nie zapisuje adresów i odrzuca ping, który zawiera jakiekolwiek inne pole.

Odpowiedź na ping zawiera listę komunikatów, które aplikacja może wyświetlić, na przykład prośbę o darowiznę albo propozycję wypróbowania OpenPencil Cloud: ich treść, miejsce w aplikacji, w którym się pojawiają, częstotliwość i wersje, które je pokazują. Wersja, która je wyświetla, sama na urządzeniu decyduje, czy przyszła pora na któryś z nich, na podstawie czasu od instalacji, wersji, platformy i tego, czy jesteś zalogowany do Cloud, i również na urządzeniu zapamiętuje, co zrobiłeś z każdym z nich, na przykład **Nie teraz**. Nic z tego nie wraca razem z pingiem. Jeśli udostępniasz statystyki użycia, mówią one, kiedy któryś z tych komunikatów się pojawił, został odłożony albo wykorzystany, podając nazwę komunikatu i miejsce, w którym się pojawił (zdarzenia poniżej); serwer przechowuje je tylko dla komunikatów, które nadal udostępnia lub które są wbudowane w aplikację, takich jak prośba o darowiznę. Przycisk komunikatu otwiera jego stronę z nazwą komunikatu w adresie, więc statystyki odwiedzin witryny pokazują, który komunikat kogoś przyprowadził, bez żadnych informacji o tobie i twoim urządzeniu. Komunikat z serwera to tekst: nie może uruchamiać kodu, wyświetlać obrazów ani prowadzić gdziekolwiek poza openpencil.dev. Wbudowana w aplikację prośba o darowiznę prowadzi do strony darowizn wskazanej przez projekt. Wersje, które kompilujesz sam, nie dostają z serwera żadnych komunikatów.

Ping jest domyślnie włączony. Wyłączysz go w **Ustawienia → Prywatność**; aplikacja nie pokazuje wtedy żadnych komunikatów z serwera.

## Statystyki użycia

Statystyki użycia są wyłączone, dopóki się nie zgodzisz. OpenPencil pyta raz, w małym okienku, które pojawia się po ekranie powitalnym przy pierwszym uruchomieniu albo przy kolejnym, jeśli jeszcze nie odpowiedziałeś, z dwoma równorzędnymi wyborami: **Nie, dziękuję** i **Udostępniaj statystyki**. Nic nie jest wybrane za ciebie, a odpowiedź możesz później zmienić w **Ustawienia → Prywatność**.

Gdy się zgodzisz, aplikacja tworzy na urządzeniu losowy identyfikator instalacji. Nie jest on powiązany z kontem, adresem e-mail ani niczym innym, co dotyczy ciebie. Zdarzenia użycia są wysyłane razem z nim oraz z polami wersji opisanymi wyżej (<code>{{ buildFields }}</code>). Gdy przestaniesz udostępniać statystyki, aplikacja usuwa identyfikator; ponowna zgoda tworzy nowy.

Oto wszystkie zdarzenia, które aplikacja może wysłać. Usługa pod adresem `feedback.openpencil.dev` sprawdza każde zdarzenie z tą listą i odrzuca każde zdarzenie, właściwość lub wartość, których na niej nie ma, więc zmodyfikowana aplikacja również nie może przez nią wysłać niczego innego.

<template v-for="event in events" :key="event.name">
  <h3><code>{{ event.name }}</code></h3>
  <p>{{ event.description }}</p>
  <SdkDataTable v-if="event.properties.length" :columns="columns" :rows="rows(event.properties)" />
</template>

Przyjęte zdarzenia trafiają do [PostHog](https://posthog.com), usługi analityki produktowej, w jej chmurze w UE. Żądanie wysyła nasz serwer, a nie twoje urządzenie, więc PostHog nigdy nie widzi twojego adresu. Zdarzenia nie tworzą profili osób i pomijają ustalanie lokalizacji. Statystyki użycia przechowujemy przez 12 miesięcy.

## Zgłoszenia błędów i problemów

Gdy własny kod OpenPencil zgłosi nieoczekiwany błąd, oficjalna wersja dodaje do powiadomienia o błędzie **Zgłoś…**; błędy z rozszerzeń przeglądarki lub bez śladu stosu go nie dostają. Jeśli OpenPencil zamknął się nieoczekiwanie po błędzie albo aplikacja desktopowa napotkała błąd wewnętrzny, przy następnym uruchomieniu pojawia się ta sama propozycja, jeden raz. **Pomoc → Zgłoś problem…** jest dostępne zawsze. Obie drogi otwierają formularz, a nic nie zostaje wysłane, dopóki nie wybierzesz **Wyślij zgłoszenie**. **Co zostanie wysłane** pokazuje dokładną treść zgłoszenia przed wysłaniem. Zawiera ono:

- W przypadku błędu: jego typ i komunikat, oczyszczone z kluczy, tokenów, adresów e-mail i twojej nazwy użytkownika w ścieżkach folderów, oraz miejsce w kodzie OpenPencil, w którym wystąpił. Błędy od dostawców AI, które mogą cytować twoje prompty, są wysyłane bez komunikatu.
- To, co napiszesz, oraz adres e-mail, jeśli go podasz, abyśmy mogli odpowiedzieć.
- Pola wersji opisane wyżej (<code>{{ buildFields }}</code>) oraz twój identyfikator instalacji, jeśli udostępniasz statystyki użycia.
- Jeśli zostawisz włączone **Dołącz ostatnią aktywność**: ostatnie 50 zdarzeń z **Ustawienia → Diagnostyka**, takich jak błędy, pomiary czasu i formaty plików. Nigdy nie zawierają wiadomości czatu ani wyników narzędzi.
- Jeśli włączysz **Dołącz ten dokument**: otwarty projekt jako plik `.fig`.

Oprócz pól wersji zgłoszenie ma te pola:

<SdkDataTable :columns="columns" :rows="reportRows" />

Zgłoszenia trafiają do `feedback.openpencil.dev`, które przekazuje je do śledzenia błędów PostHog w jego chmurze w UE, bez twojego adresu, profilu osoby i ustalania lokalizacji, i samo niczego z nich nie przechowuje. Dołączony projekt jest przechowywany w Cloudflare R2 w UE, może go otworzyć tylko zespół OpenPencil i jest usuwany po 90 dniach.

## Wyłączanie wszystkiego

- **Ustawienia → Prywatność** mają przełącznik pingu i przełącznik statystyk użycia.
- W aplikacji desktopowej uruchomienie OpenPencil z `OPENPENCIL_TELEMETRY=0` lub `DO_NOT_TRACK=1` w środowisku wyłącza oba.
- Cokolwiek wysyłają tylko oficjalne wydania. Serwery deweloperskie, samodzielnie zbudowane aplikacje i forki nie wysyłają niczego, bo przełącznik włączający wysyłanie ustawiamy tylko podczas budowania wydania.

## Inne żądania sieciowe

OpenPencil działa przede wszystkim lokalnie, ale niektóre funkcje korzystają z sieci. Aplikacja desktopowa sprawdza aktualizacje przy uruchomieniu, chyba że wyłączysz to w **Ustawienia → Ogólne**. **Pomoc → Sprawdź aktualizacje…** nadal sprawdza. Wszystko inne poniżej łączy się tylko wtedy, gdy używasz danej funkcji, i tylko z wymienioną usługą.

| Funkcja                       | Z czym się łączy                                                                                                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprawdzanie aktualizacji (desktop) | GitHub Releases, aby poznać numer najnowszej wersji                                                                                                                                                                                                                            |
| Czat AI i narzędzia do obrazów | Skonfigurowany przez ciebie dostawca, z twoim własnym kluczem; lista modeli pochodzi z models.dev. Gdy dostawcą jest **OpenPencil Cloud**: usługa AI wskazana przez twój serwer Cloud, z tokenem twojej przestrzeni roboczej                                                       |
| Pokoje współpracy              | Bezpośrednio inne osoby w pokoju; publiczne pośredniki przedstawiają sobie uczestników, a przekaźnik TURN przenosi ruch, gdy bezpośrednie połączenie nie jest możliwe                                                                                                              |
| Przechowywanie w chmurze       | Skonfigurowany przez ciebie dostawca przechowywania                                                                                                                                                                                                                                |
| Czcionki                       | Google Fonts, które mogą dostarczyć używaną w dokumencie czcionkę, której nie masz zainstalowanej                                                                                                                                                                                   |
| Ikony                          | Iconify API, gdy wyszukujesz lub wstawiasz ikony                                                                                                                                                                                                                                    |
| Ikony w importowanym HTML      | jsDelivr, po indeks ikon, oraz Iconify API, po ikony-kandydatów, z którymi porównywany jest osadzony SVG, według nazwy (sam SVG nigdy nie jest wysyłany), gdy importujesz HTML; wyłączysz to w **Ustawienia → Edytor** lub przekazując `--no-icon-names` do `openpencil import` |
| Otwórz z adresu URL            | Otwierany adres oraz arkusze stylów, czcionki i obrazy, do których prowadzi jego strona, pobierane z twojego urządzenia                                                                                                                                                             |
| Zdjęcia stockowe               | Unsplash lub Pexels, z twoim własnym kluczem, gdy je wyszukujesz lub umieszczasz jedno z ich zdjęć                                                                                                                                                                                 |

Aplikacja, usługa opinii i ta strona są open source. Lista zdarzeń znajduje się w [`packages/feedback/src/contract`](https://github.com/open-pencil/open-pencil/tree/master/packages/feedback/src/contract), a powyższe tabele są z niej generowane.
