---
pageClass: guide
title: Modelle und Anbieter
description: Mit welchen KI-Anbietern der Chat funktioniert, was im Browser und in der Desktop-App geht und was zu tun ist, wenn ein Anbieter nicht erreichbar ist.
---

<script setup>
import ModelProviders from '#docs/theme/components/ModelProviders.vue'
</script>

# Modelle und Anbieter

Der [KI-Chat](./ai-chat) verwendet ein Modell, das du verbindest: einen [Coding-Agenten](./coding-agents), den du schon hast, einen API-Schlüssel eines Anbieters, dein Konto bei [OpenPencil Cloud](/cloud/ai) oder deinen eigenen Server. Mit einem API-Schlüssel oder deinem eigenen Server gehen Anfragen direkt von der App zum Anbieter, und ein Coding-Agent nutzt seine eigene Verbindung. Die KI von OpenPencil Cloud läuft über Clouds eigenen Dienst, der jede Anfrage an den Modellanbieter weiterleitet, den er nutzt.

Füge ein Modell unter **Einstellungen → Modelle** hinzu oder lass das die geführte Einrichtung erledigen. Bei einer frischen Installation richtet sich die KI von selbst ein, wenn du dich bei OpenPencil Cloud mit einem Tarif anmeldest, der KI enthält; ein Modell, das du schon eingerichtet hast, bleibt, wie es ist.

Die geführte Einrichtung gibt außerdem jeder Art von Arbeit das Modell, das der Anbieter dafür empfiehlt, außer deine bisherige Zuweisung funktioniert noch: **Design-Agent** führt den Chat, **Prüfung** kritisiert Designs anhand von Screenshots, **Schnelle Aufgaben** erledigt kleine Arbeiten wie das Benennen von Chats, und **Vision** liest Bilder. Vision wird nur eingerichtet, wenn du angibst, dass du mit Bildern arbeiten willst. Ein Anbieter, dessen Hauptmodell keine Bilder liest, etwa DeepSeek oder Z.ai, prüft Designs und liest Bilder, wenn du darum bittest, mit einem seiner Modelle, das das kann, sofern er eines hat. Du kannst jede Zuweisung unter **Zuweisungen** in **Einstellungen → Modelle** ändern.

## Anbieter

<ModelProviders />

**OpenAI-compatible** passt zu den meisten anderen Diensten und lokalen Servern, mit einem Schalter zwischen der Completions- und der Responses-API. **Anthropic-compatible** passt zu Diensten, die Anthropics Messages API sprechen. Gib die Basis-URL, den Schlüssel und die Modell-ID ein, die dein Server erwartet.

Bei **OpenRouter** kannst du dich auch anmelden, statt einen Schlüssel einzufügen.

**ChatGPT** nutzt deinen ChatGPT-Tarif statt eines API-Schlüssels, und seine Antworten zählen zu den Limits des Tarifs. Das gibt es nur in der Desktop-App. Die Anmeldung öffnet den Browser und kehrt über `localhost:1455` zur App zurück, die einzige Adresse, die OpenAI akzeptiert; schließe also vorher ein laufendes `codex login`. Die Anmeldung erneuert sich selbst, und die Liste der Modelle kommt aus deinem Konto.

## Im Browser und in der Desktop-App

Die Desktop-App erreicht jeden Anbieter und bewahrt Schlüssel im Anmeldedatenspeicher deines Systems auf. Außerdem bietet sie, was der Browser nicht kann: Coding-Agenten und die Anmeldung mit ChatGPT.

Die Web-App sendet Anfragen aus dem Browser, daher muss der Anbieter das erlauben (CORS). Die eingebauten Anbieter tun das; bei deinem eigenen Server oder einem anderen Dienst prüfe es, bevor du dich darauf verlässt.

Zeigt die Web-App **„Dieser Endpunkt ist vom Browser aus nicht erreichbar“**, hat die Anfrage nie eine Antwort bekommen, die der Browser akzeptieren würde. Entweder erlaubt der Anbieter keine Browseranfragen, oder er erlaubt sie, lässt die Erlaubnis aber bei seinen Fehlerantworten weg, sodass ein falscher Schlüssel oder Modellname genauso aussieht. Probiere dieselben Einstellungen in der Desktop-App aus: Funktionieren sie dort, blockiert der Anbieter den Browser. [Testing a Model Provider](/development/testing-model-providers) zeigt, wie du einen Anbieter selbst prüfst.

## Ein Modell wählen

Der Chat arbeitet, indem er Werkzeuge aufruft, daher muss ein Modell **Werkzeugaufrufe** unterstützen und sie zuverlässig streamen; Modelle unterscheiden sich hier selbst beim gleichen Anbieter. Mit **Vision** kann der Chat außerdem Bilder ansehen und seine eigene Arbeit prüfen.

Reasoning-Modelle können ihr ganzes Ausgabebudget mit Nachdenken verbrauchen. Hört ein Modell auf, ohne etwas zu tun, erhöhe seine **Maximale Ausgabetoken** oder senke seine **Denkstufe**.

Jeder Schritt einer Antwort sendet den Gesprächsverlauf und die Werkzeugbeschreibungen erneut, daher verbrauchen lange Antworten viele Eingabetoken. **Maximale Schritte pro Nachricht** unter **Chat** in **Einstellungen → Modelle** begrenzt das für die eingebaute KI, während Coding-Agenten ihre eigenen Grenzen setzen; siehe [Während die KI arbeitet](./ai-chat#wahrend-die-ki-arbeitet).

## Deine Schlüssel schützen

Im Browser werden Schlüssel verschlüsselt im Browserspeicher aufbewahrt, damit du sie nicht erneut eingeben musst; in den Einstellungen kannst du sie stattdessen nur für die Sitzung behalten. Die Desktop-App nutzt den Anmeldedatenspeicher deines Systems. Ein im Browser gespeicherter Schlüssel kann trotzdem von Skripten verwendet werden, die auf der Seite laufen, daher solltest du eingeschränkte Schlüssel mit Ausgabenlimits bevorzugen, wo der Anbieter sie anbietet.
