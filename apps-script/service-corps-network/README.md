# Food Aid Project Service Corps Network Backend

Status: SOURCE IMPLEMENTED / NOT DEPLOYED

This Google Apps Script project turns the public Service Corps questionnaire into a controlled intake and follow-up system using Google Workspace services already associated with Food Aid Project.

## What it does

A successful questionnaire submission:

1. Creates a structured record in a private Google Sheet.
2. Assigns transparent routing tags and a review priority.
3. Flags authority approval, minor/guardian review, unclear approval status, and urgent deadlines.
4. Suggests up to three matches from the `Opportunities` sheet.
5. Creates a follow-up task and review deadline.
6. Sends an acknowledgment email to the respondent.
7. Sends an internal alert to `info@foodaidproject.org` or the configured review address.
8. Creates a JoieOS-compatible import bundle in the `JoieOS Queue` sheet.
9. Records an immutable operational audit entry.

The automated score is only a **review-order tool**. It does not accept or reject a person, approve community-service hours, determine legal suitability, or replace human review.

## Sheets created

- `Intake` — source-of-truth intake records and review status.
- `FollowUp` — review tasks, due dates, reminders, and completion status.
- `Opportunities` — Food Aid Project needs available for skill matching.
- `JoieOS Queue` — private JoieOS import bundles.
- `Audit` — operational events and errors.

## Required Script Properties

Open **Apps Script → Project Settings → Script Properties** and set:

| Property | Required | Example / purpose |
|---|---:|---|
| `SPREADSHEET_ID` | Yes for standalone script | ID of the private Service Corps Network spreadsheet |
| `REVIEW_EMAIL` | No | Defaults to `info@foodaidproject.org` |
| `ALLOWED_ORIGINS` | Yes before public deployment | `https://www.foodaidproject.org,https://foodaidproject.org` |
| `JOIEOS_EXPORT_FOLDER_ID` | No | Drive folder for JoieOS JSON exports |

Never commit deployment URLs, private spreadsheet IDs, tokens, or respondent data to GitHub.

## Installation

1. Create a private Google Sheet owned by Food Aid Project.
2. Create a standalone Apps Script project or bind the script to that sheet.
3. Add `Code.gs` and `appsscript.json`.
4. Configure the Script Properties above.
5. Run `installServiceCorpsNetwork()` once from the Apps Script editor.
6. Review and authorize the requested Google permissions.
7. Confirm that all five sheets and the daily reminder trigger exist.
8. Add controlled test opportunities to the `Opportunities` sheet.
9. Deploy as a Web App:
   - Execute as: the deploying Food Aid Project account.
   - Who has access: Anyone.
10. Copy the `/exec` deployment URL into the website configuration only after review and approval.

## Website submission model

The public form posts to the Apps Script Web App through a hidden iframe. This avoids browser CORS dependencies. The Apps Script response uses `postMessage` to return only:

- success or failure;
- a public-safe message; and
- the intake reference number.

The website keeps an email fallback if the endpoint is unavailable or has not been configured.

## Review workflow

Recommended statuses:

- `NEW`
- `ACKNOWLEDGED`
- `REVIEWING`
- `NEEDS-INFORMATION`
- `POTENTIAL-FIT`
- `NETWORK-HOLD`
- `NEXT-STAGE-SCREENING`
- `NOT-A-FIT`
- `WITHDRAWN`
- `DELETE-REQUESTED`
- `COMPLETE`

The initial task created for each record is `INITIAL_REVIEW`.

Review deadlines are currently:

- `URGENT`: 4 hours
- `HIGH`: 24 hours
- `NORMAL`: 72 hours
- `LOW`: 7 days

A court/agency deadline can shorten the review deadline. The daily trigger emails overdue review reminders.

## Opportunity matching

Populate the `Opportunities` sheet with `OPEN` records. Matching uses:

- skill-tag overlap;
- participation-tag overlap;
- remote/in-person format;
- region; and
- broad availability.

Matches are recommendations for human review, not assignments.

## JoieOS integration

Choose **Service Corps Network → Export pending JoieOS records** in the spreadsheet menu. The script creates a JSON export containing:

- a private `Person` object;
- an intake `Conversation` object;
- a review `Commitment` object;
- relationships to the Service Corps program; and
- an immutable intake Event.

The corresponding JoieOS import panel deduplicates records by immutable ID. No public respondent data should be committed to the JoieOS repository.

## Security and privacy controls

- Honeypot bot field.
- Per-email rate limiting.
- Required source-origin value.
- Required consent and acknowledgments.
- Server-side validation and length limits.
- No charge, case-number, medical, financial-account, password, or confidential-legal fields.
- Private Google Sheet rather than a public repository.
- Minimal public response data.
- No automatic participant acceptance or legal determination.

The `sourceOrigin` check is a defense-in-depth signal, not cryptographic authentication. A public web form cannot keep a shared secret. Rate limiting, validation, bot controls, monitoring, and limited collected data remain necessary.

## Deployment boundary

Creating this source does not authorize deployment. Before deployment:

- confirm spreadsheet ownership and access;
- confirm email sender identity and quota;
- conduct a test using non-sensitive dummy data;
- verify acknowledgment and internal alert content;
- verify daily reminders;
- verify JoieOS export/import;
- confirm privacy notice wording;
- approve the endpoint URL update; and
- approve production publication separately.
