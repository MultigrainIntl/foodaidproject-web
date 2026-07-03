# Service Corps Network — GAJ Guided Activation Checklist

Status: NOT STARTED

This checklist contains only the Google account-owned actions that cannot be completed from source control. ChatGPT or Claude can prepare and review every other step.

## Gate A — Create the private data store

- [ ] Sign in to the Google Workspace account that should own Food Aid Project intake records.
- [ ] Create a new private Google Sheet named `Food Aid Project Service Corps Network`.
- [ ] Confirm sharing is **Restricted**.
- [ ] Copy the spreadsheet ID from the URL for use as an Apps Script property. Do not paste it into GitHub or public chat.

## Gate B — Install the prepared Apps Script

- [ ] In the Sheet, choose **Extensions → Apps Script**.
- [ ] Replace the editor contents with the reviewed `Code.gs` source.
- [ ] Open **Project Settings**, enable the manifest file if needed, and use the reviewed `appsscript.json` source.
- [ ] Add Script Property `SPREADSHEET_ID` with the private spreadsheet ID.
- [ ] Add Script Property `REVIEW_EMAIL` with `info@foodaidproject.org`.
- [ ] Add Script Property `ALLOWED_ORIGINS` with `https://www.foodaidproject.org,https://foodaidproject.org`.
- [ ] Run `installServiceCorpsNetwork()`.
- [ ] Review and approve only the requested Sheet, email-send, trigger, and Drive-file permissions.
- [ ] Confirm these tabs exist: `Intake`, `FollowUp`, `Opportunities`, `JoieOS Queue`, and `Audit`.

## Gate C — Dummy-data test before deployment

- [ ] Add one dummy `OPEN` opportunity to the `Opportunities` tab.
- [ ] Use a non-sensitive test identity and email address.
- [ ] Confirm the record appears in `Intake`.
- [ ] Confirm a review task appears in `FollowUp`.
- [ ] Confirm a bundle appears in `JoieOS Queue`.
- [ ] Confirm an audit event appears in `Audit`.
- [ ] Confirm the test applicant receives the acknowledgment.
- [ ] Confirm `info@foodaidproject.org` receives the internal alert.
- [ ] Delete or clearly mark all dummy records after testing.

## Gate D — Deploy the endpoint

- [ ] Choose **Deploy → New deployment → Web app**.
- [ ] Execute as: the Food Aid Project deploying account.
- [ ] Access: Anyone.
- [ ] Deploy and copy the `/exec` URL.
- [ ] Test the URL with `?mode=health` and confirm it reports the Service Corps Network and `remote-only`.
- [ ] Do not publish the URL in documentation or messages beyond the controlled website configuration step.

## Gate E — Connect the public questionnaire

- [ ] Open a separate production-activation pull request.
- [ ] Insert only the reviewed `/exec` URL into `service-corps-config.js`.
- [ ] Run static and rendered browser tests.
- [ ] Submit one dummy questionnaire from the website preview.
- [ ] Confirm reference number, Sheet record, acknowledgment, internal alert, follow-up task, and JoieOS queue record.
- [ ] Approve merge and production publication only after the complete test passes.

## Gate F — JoieOS intake test

- [ ] In the private Sheet, choose **Service Corps Network → Export pending JoieOS records**.
- [ ] Download the resulting JSON file from the private Drive folder.
- [ ] Open JoieOS Mission Control.
- [ ] Choose **Import Service Corps Intakes**.
- [ ] Review the validated preview.
- [ ] Import the dummy batch.
- [ ] Confirm the Person, Conversation, Commitment, Relationships, and Event are private and visible in the Food Aid workspace.
- [ ] Re-import the same file and confirm duplicates are skipped.

## Stop conditions

Stop immediately if:

- the Sheet is not Restricted;
- the script requests permissions beyond the documented set;
- the test sends or stores sensitive information;
- the website reports success but no Sheet record exists;
- the acknowledgment implies placement or approved hours;
- an imported JoieOS object is not private; or
- duplicate records are created.
