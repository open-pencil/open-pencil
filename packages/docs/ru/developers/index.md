---
layout: doc
title: Разработчикам
description: Обрабатывайте файлы дизайна сценариями из терминала, доверьте управление редактором агенту ИИ или создайте собственный редактор на движке OpenPencil.
---

# Разработчикам

Всё, что умеет редактор, доступно и за его пределами: из терминала, агентам ИИ и программному коду. Всё работает на том же движке, что и приложение, поэтому любое действие, которое можно выполнить мышью, можно выполнить и сценарием. Выберите инструмент под свою задачу.

## Сценарии для файлов дизайна

CLI `openpencil` читает, проверяет, экспортирует и редактирует файлы `.fig` и `.pen` без запуска приложения и выводит JSON для сценариев и CI. Когда запущено настольное приложение, та же CLI управляет им: открывает и сохраняет документы, отменяет изменения, меняет настройки и вызывает любой инструмент редактора.

<SdkCardGroup>
  <SdkCard title="Справочник команд" to="/reference/cli" description="Все команды и их параметры." />
  <SdkCard title="Просмотр документов" to="/ru/developers/cli/inspecting" description="Страницы, узлы, запросы XPath и токены дизайна." />
  <SdkCard title="Экспорт" to="/ru/developers/cli/exporting" description="Изображения, JSX, HTML, токены дизайна и истории Storybook." />
  <SdkCard title="Сценарии" to="/ru/developers/cli/scripting" description="Figma Plugin API и API openpencil через eval." />
</SdkCardGroup>

## Дизайн силами агента ИИ

Сервер MCP даёт Claude Code, Cursor, Windsurf и любому клиенту MCP те же 90 инструментов, что использует встроенный помощник, так что агент может читать, создавать и изменять дизайн. Агенты описывают интерфейс на JSX, из которого получаются настоящие фреймы, текст и автоматическая компоновка.

<SdkCardGroup>
  <SdkCard title="Сервер MCP" to="/developers/mcp-server" description="Подключение клиента через stdio или HTTP." />
  <SdkCard title="Рендерер JSX" to="/ru/developers/jsx-renderer" description="Создание деревьев компонентов из JSX и экспорт выделения обратно в JSX." />
  <SdkCard title="Справочник JSX для дизайна" to="/reference/design-authoring" description="Что принимает JSX для дизайна." />
</SdkCardGroup>

Чтобы работать с агентом прямо в приложении, см. [Чат с ИИ](../user-guide/ai-chat) и [Агенты для программирования](/user-guide/coding-agents).

## Собственный редактор

`@open-pencil/vue` — это Vue SDK, на котором построено само приложение: контекст редактора, холст, выделение, команды и панели без встроенного оформления, которые вы оформляете сами. Библиотеки движка работают и без Vue — в браузере или на сервере.

<SdkCardGroup>
  <SdkCard title="Vue SDK" to="/ru/developers/sdk/" description="Встройте редактор или создайте специализированный." />
  <SdkCard title="Нативные API JavaScript" to="/developers/native-api" description="Библиотеки движка без интерфейса." />
  <SdkCard title="Схема URL" to="/ru/developers/url-scheme" description="Ссылка со страницы прямо на слой в приложении." />
</SdkCardGroup>

## Как это устроено

<SdkCardGroup>
  <SdkCard title="Справочник" to="/reference/node-types" description="Типы узлов, граф сцены, соответствие DOM/CSS и формат файла." />
  <SdkCard title="Участие в разработке" to="/development/contributing" description="Сборка приложения, запуск тестов и отправка изменений." />
</SdkCardGroup>
