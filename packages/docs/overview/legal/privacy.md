---
title: OpenPencil Cloud Privacy Policy
description: What OpenPencil Cloud at cloud.openpencil.dev stores about you, where, for how long, and who processes it.
---

# OpenPencil Cloud Privacy Policy

::: warning Draft
This is a draft awaiting legal review. It is not in force, and it changes before OpenPencil Cloud opens. Text in [brackets] is still to be filled in.
:::

Version: 2026-11-15

This policy covers OpenPencil Cloud at `cloud.openpencil.dev` (the "Service"), run by [operator legal name], [address], the controller of your personal data. What the OpenPencil app itself sends, with or without the Service, is described in [Privacy and Usage Stats](../privacy). A Cloud server someone else runs has its own operator and policy.

## Where your data is

The Service's database, file storage, and live collaboration run in the European Union: the database with Neon in Frankfurt, files in a Cloudflare R2 bucket in Cloudflare's EU jurisdiction, and collaboration rooms in Cloudflare's EU jurisdiction. Requests pass through Cloudflare's network, which may serve them from a data center near you.

## What we store

| What | Why | How long |
| --- | --- | --- |
| Account: email, name, picture, sign-in methods (Google, passkeys, two-step settings) | To sign you in and show you to collaborators | Until you delete your account |
| Your documents, their revisions and versions, and images in them | To provide the Service | Until you delete them, then as below |
| Workspaces, members, sharing links, invitations, and the email addresses you invite | To share documents | Until removed, or the workspace is deleted |
| Sign-in history: time, method, IP address, and browser | To show you your sessions and warn you of new sign-ins | Until you delete your account |
| Which version of the terms you accepted, and when | To show you agreed | Until you delete your account |
| Reports about shared documents, and what administrators did about them | To handle abuse | [period] |
| Rate-limit counters, by IP address or account | To protect the Service | Up to a day |
| Usage of services credits | To apply your monthly allowance | [period] |

We don't sell your data, show ads, or use your documents to train models.

## Deleting

- A deleted document stays in Trash for 30 days, where you or a workspace admin can restore it.
- After that, or when it's deleted forever, it's hidden but kept for 7 more days so a mistake can be undone, then removed.
- Files removed this way are kept in a separate area of storage for 14 days in case the database has to be restored from a backup, then deleted.
- Database backups let us restore the Service to a point in the last 7 days.
- Deleting your account removes your account data at once and deletes documents in workspaces only you belong to, as above. Documents you created in shared workspaces stay with those workspaces.

## Logs and error reports

- Cloudflare keeps request logs, including IP addresses, for up to 7 days to run and secure the Service.
- When the server hits an error, it sends a report to PostHog's EU Cloud with the error, where it happened, and a request ID. Reports name no account and leave out IP addresses and request contents, though an error message can quote a value the failing code handled.

## Email

The Service sends sign-in, security, invitation, and account emails through Cloudflare. It doesn't send marketing email.

## Services

When you use hosted services such as AI chat, what you send is forwarded to the model provider to produce a response, as listed under [Subprocessors](./subprocessors). The Service stores how many credits each request used, not its content.

## Your rights

You can see and download your documents, change your account details, and delete your account from your account settings. Under the GDPR you can also ask us for a copy of your data, to correct or erase it, to restrict or object to processing, and you can complain to your data protection authority. Write to [privacy contact].

Legal bases: running the Service you signed up for (contract), keeping it secure and fixing errors (legitimate interests), and meeting legal obligations.

## Changes

We'll tell you about material changes before they take effect. The version date above changes with each version.

## Contact

[privacy contact] · [operator legal name], [address]
