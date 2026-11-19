---
title: OpenPencil Cloud Privacy Policy
description: What OpenPencil Cloud at cloud.openpencil.dev stores about you, where, for how long, and who processes it.
---

# OpenPencil Cloud Privacy Policy

Version: 2026-11-18

This policy covers OpenPencil Cloud at `cloud.openpencil.dev` (the "Service"), run by Alena Poyarkova, a sole trader registered in Mexico (RFC POAL920708M63), the controller of your personal data. What the OpenPencil app itself sends, with or without the Service, is described in [Privacy and Usage Stats](/overview/privacy). A Cloud server someone else runs has its own operator and policy.

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
| Reports about shared documents, and what administrators did about them | To handle abuse | 1 year after the report is closed |
| Rate-limit counters, by IP address or account | To protect the Service | Up to a day |
| Usage of services credits | To apply your monthly allowance | 12 months |
| Billing: your Stripe customer ID, your plan and when it renews, and the credits you bought | To provide what you pay for | Until you delete your account |
| Payment records: what you bought, when, and for how much | To meet tax and accounting law | 5 years from the filing of the tax return they belong to, as Mexican tax law requires, or longer while a tax audit or claim needs them |

We don't sell your data, show ads, or use your documents to train models.

## Deleting

- A deleted document stays in Trash for 30 days, where you or a workspace admin can restore it.
- After that, or when it's deleted forever, it's hidden but kept for 7 more days so a mistake can be undone, then removed.
- Files removed this way are kept in a separate area of storage for 14 days in case the database has to be restored from a backup, then deleted.
- Database backups let us restore the Service to a point in the last 7 days.
- Deleting your account removes your account data at once and deletes documents in workspaces only you belong to, as above. Documents you created in shared workspaces stay with those workspaces.

## Logs and error reports

- Cloudflare keeps request logs, including IP addresses, for up to 7 days to run and secure the Service.
- When the server hits an error, it sends a report to PostHog's EU Cloud with the error, where it happened, a request ID, your account ID if you were signed in, and the IDs of the records involved (documents, workspaces, comment threads, comments, versions, revisions, shares, and uploads), so we can find and fix what failed for you. Reports carry no names, emails, or IP addresses, and no document contents, though an error message can quote a value the failing code handled. They create no profile of you in PostHog.

## Email

The Service sends sign-in, security, invitation, and account emails through Cloudflare. It doesn't send marketing email.

## Services

When you use hosted services such as AI chat, what you send is forwarded to the model provider to produce a response, as listed under [Subprocessors](./subprocessors). The Service stores how many credits each request used, not its content.

## Payments

When you buy a plan or credits, Stripe processes the payment. We give Stripe your account email, for receipts and invoices; your card details and billing address go straight to Stripe and never reach us. Stripe processes them for us to take the payment, work out tax, and send receipts and invoices. For its own purposes, such as preventing fraud and meeting the law that applies to payment providers, Stripe is a controller in its own right, under its [privacy policy](https://stripe.com/privacy). We keep only what's listed above.

## Your rights

You can see and download your documents, change your account details, and delete your account from your account settings. Under the GDPR you can also ask us for a copy of your data, to correct or erase it, to restrict or object to processing, and you can complain to your data protection authority. Write to [privacy@openpencil.dev](mailto:privacy@openpencil.dev).

Because we are based in Mexico, Mexico's Federal Law on the Protection of Personal Data Held by Private Parties also applies. Its rights of access, rectification, cancellation, and opposition (ARCO) work the same way: write to the address above, and we answer within 20 days. You can complain to the Mexican data protection authority, the Secretaría Anticorrupción y Buen Gobierno.

Legal bases: running the Service you signed up for (contract), keeping it secure and fixing errors (legitimate interests), and meeting legal obligations.

## Changes

We'll tell you about material changes before they take effect. The version date above changes with each version.

## Contact

[privacy@openpencil.dev](mailto:privacy@openpencil.dev) · Alena Poyarkova (RFC POAL920708M63)
