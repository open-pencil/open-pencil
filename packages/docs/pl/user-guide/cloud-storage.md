---
pageClass: guide
title: Przechowywanie w chmurze
description: Przechowywanie dokumentów i bibliotek komponentów we własnym zasobniku zgodnym z S3 — AWS S3, Backblaze B2, Cloudflare R2, MinIO i innych.
---

# Przechowywanie w chmurze

OpenPencil może przechowywać dokumenty w twoim własnym zasobniku w dowolnej usłudze zgodnej z S3: AWS S3, Backblaze B2, Cloudflare R2, MinIO i innych. Nie ma po drodze żadnego serwera OpenPencil; edytor łączy się z zasobnikiem bezpośrednio, używając twoich kluczy dostępu.

## Łączenie zasobnika

Otwórz **Ustawienia → Przechowywanie**, wybierz **Przechowywanie S3** i wypełnij pola:

| Pole                              | Co wpisać                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Punkt końcowy**                 | Adres URL API S3 dostawcy, razem z wymaganą ścieżką. Zobacz przykłady poniżej.                       |
| **Zasobnik**                      | Nazwa zasobnika.                                                                                     |
| **Region**                        | Opcjonalne. Jeśli zostawisz puste, zostanie odczytane z punktu końcowego, a gdy się nie da — `us-east-1`. |
| **Identyfikator klucza dostępu**  | Klucz dostępu z uprawnieniami do odczytu, zapisu, listowania i usuwania w zasobniku.                 |
| **Tajny klucz dostępu**           | Sekret tego klucza.                                                                                  |

Przykłady punktów końcowych:

- AWS S3: `https://s3.eu-west-1.amazonaws.com`
- Backblaze B2: `https://s3.eu-central-003.backblazeb2.com`
- Cloudflare R2: `https://<account-id>.r2.cloudflarestorage.com`
- MinIO: `http://localhost:9000` lub adres, pod którym nasłuchuje twój serwer

Wybierz **Testuj połączenie**, aby przed zapisaniem sprawdzić punkt końcowy, klucze i zasobnik, a potem **Zapisz**. OpenPencil sam dodaje zasobnik do punktu końcowego, jako `{endpoint}/{bucket}/{key}`, więc nie wpisuj nazwy zasobnika w punkt końcowy.

W aplikacji desktopowej klucze dostępu są przechowywane w systemowym magazynie poświadczeń. W przeglądarce są szyfrowane w pamięci przeglądarki albo przechowywane tylko do zamknięcia sesji, gdy opcja **Ustawienia → Ogólne → Zapamiętaj klucze API na tym urządzeniu** jest wyłączona.

## Zezwalanie aplikacji webowej w CORS

Przeglądarka może połączyć się tylko z zasobnikiem, który przyjmuje żądania ze źródła strony, więc aplikacja webowa potrzebuje w zasobniku reguły CORS. Aplikacja desktopowa wysyła żądania natywnie i jej nie potrzebuje.

Dodaj regułę podobną do tej, ze źródłami, z których otwierasz OpenPencil:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["https://cloud.openpencil.dev"],
    "ExposeHeaders": ["ETag", "Content-Range", "x-amz-request-id", "x-amz-id-2", "x-amz-version-id"],
    "MaxAgeSeconds": 3600
  }
]
```

Aplikacja webowa przenosi się z app.openpencil.dev na cloud.openpencil.dev: do reguły ustawionej dla starego adresu trzeba dodać nowy. Ustawisz ją w konsoli AWS w sekcji zasobnika **Permissions → Cross-origin resource sharing**, w panelu Cloudflare w sekcji zasobnika R2 **Settings → CORS policy** albo za pomocą CLI swojego dostawcy. Gdy reguły brakuje, **Testuj połączenie** zgłasza, że przeglądarka nie mogła połączyć się z zasobnikiem z bieżącej witryny.

## Zapisywanie dokumentu w magazynie

Otwórz lub utwórz dokument, a potem wybierz **Plik → Zapisz w…**. Jeśli nie ma obszaru roboczego Cloud do wyboru, dokument zostanie zapisany od razu w zasobniku; w przeciwnym razie wybierz zasobnik z listy. Karta pozostaje z nim powiązana: **Zapisz** i automatyczne zapisywanie zapisują teraz do magazynu zamiast do pliku lokalnego. Lokalny plik `.fig`, który był otwarty, zachowuje ostatnio zapisaną zawartość.

Aby otworzyć zapisane dokumenty, wybierz swój zasobnik na pasku bocznym **Strony głównej**. **Nowy projekt** przy wybranym zasobniku tworzy w nim dokument. **Strona główna** pokazuje wszystkie dokumenty w zasobniku z podglądem odczytanym z samego dokumentu, więc wyświetlenie dużego pliku na liście pobiera tylko osadzoną w nim miniaturę.

## Jak działa zapisywanie

Zapisywanie najpierw zapisuje dokument na tym urządzeniu, a potem wysyła go w tle, więc edycja nigdy nie czeka na sieć. Jeśli wysyłanie się nie powiedzie albo jesteś offline, jest ponawiane z coraz dłuższymi przerwami, a zaległe operacje wznawiają się po ponownym połączeniu lub zmianie ustawień przechowywania.

Każdy dokument jest wysyłany w całości. Gdy dwa urządzenia zapisują ten sam dokument, wygrywa ostatnie wysłanie.

Otwierane dokumenty pozostają w pamięci podręcznej urządzenia, aby szybciej je ponownie otwierać, do 500 MB. Gdy pamięć podręczna się zapełni, usuwane są tylko kopie w pełni wysłane, a przy następnym otwarciu są pobierane ponownie.

## Biblioteki komponentów

Zasobnik może też przechowywać biblioteki komponentów. W **Zasoby → Zarządzaj bibliotekami** przełącz źródło na **Przechowywanie**, aby publikować i włączać biblioteki tam, a nie na tym urządzeniu. Publikowanie korzysta z zapisów warunkowych, więc dwie osoby publikujące jednocześnie tę samą bibliotekę nie nadpiszą sobie nawzajem wersji. Publikowanie i aktualizowanie bibliotek opisuje strona [Biblioteki komponentów](./component-libraries).

## Co jest w zasobniku

OpenPencil zapisuje tylko pod dwoma prefiksami i nie rusza niczego innego w zasobniku:

- `open_pencil_storage/canvases/` — każdy dokument jako `<id>.fig`, a jego nazwa i czas modyfikacji w `<id>.meta.json`.
- `open-pencil/libraries/` — plik `manifest.json` każdej biblioteki i jej opublikowane wersje.

## Uwagi o dostawcach

- **Cloudflare R2** wymaga w regule CORS dokładnego źródła aplikacji webowej; nie przyjmuje źródeł z symbolami wieloznacznymi, takich jak `https://*.example.com`.
- **MinIO** odpowiada na żądania CORS z dowolnego źródła, chyba że skonfigurujesz to inaczej.
- **`rclone serve s3`** działa z dwoma ograniczeniami. Odrzuca wstępne żądania CORS (preflight), więc aplikacja webowa potrzebuje przed nim odwrotnego serwera proxy, który na nie odpowiada; aplikacja desktopowa go nie potrzebuje. Ignoruje też zapisy warunkowe, więc równoczesne publikacje bibliotek nie są wykrywane.
