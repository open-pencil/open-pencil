---
title: API de configuración regional
description: Configurar idioma, mensajes personalizados y alternativas del SDK.
---

# API de configuración regional

Las API regionales permiten elegir el idioma del SDK y sustituir mensajes concretos.

- `locale` contiene la configuración regional efectiva después de aplicar preferencias y alternativa.
- `messages` contiene el catálogo resuelto.
- `t(key, params?)` traduce una clave.
- la configuración de la aplicación puede proporcionar catálogos parciales propios.

Los identificadores de claves y nombres de configuración permanecen en inglés porque forman parte de la API.

## Véase también

- [useI18n](../composables/use-i18n)
