const FAP = Object.freeze({
  VERSION: '1.1.0',
  INTAKE_SHEET: 'Intake',
  FOLLOW_UP_SHEET: 'FollowUp',
  OPPORTUNITIES_SHEET: 'Opportunities',
  JOIEOS_SHEET: 'JoieOS Queue',
  AUDIT_SHEET: 'Audit',
  DEFAULT_REVIEW_EMAIL: 'info@foodaidproject.org',
  PROGRAM_ID: 'project-food-aid-skills-service-corps',
  WORKSPACE_ID: 'workspace-food-aid',
  OWNER_ID: 'person-george',
});

const INTAKE_HEADERS = [
  'Intake ID', 'Submitted At', 'Status', 'Review Priority', 'Priority Score',
  'Routing Tags', 'Review Flags', 'Suggested Matches', 'Full Name', 'Email',
  'Phone', 'Preferred Contact', 'City', 'Region', 'Country', 'Adult Status',
  'Participation', 'Hours Needed', 'Deadline', 'Jurisdiction', 'Approval Status',
  'Authority Notes', 'Skills Summary', 'Love To Do', 'Skill Areas',
  'Relationships and Audiences', 'Meaningful Service', 'Outreach Platforms',
  'Public Profile', 'Audience Size', 'Audience Description', 'Content Formats',
  'Outreach Ideas', 'Service Format', 'Weekly Hours', 'Start Time', 'Time Zone',
  'Schedule', 'Heard About', 'Referrer', 'Consent Contact', 'Consent Updates',
  'Sensitive Info Acknowledged', 'No Credit Guarantee Acknowledged',
  'Source Origin', 'Last Contact At', 'Next Review At', 'Assigned To',
  'Internal Notes', 'Record Version'
];

const FOLLOW_UP_HEADERS = [
  'Task ID', 'Intake ID', 'Created At', 'Due At', 'Status', 'Priority',
  'Task Type', 'Assigned To', 'Person Name', 'Person Email', 'Routing Tags',
  'Suggested Matches', 'Last Reminder At', 'Completed At', 'Notes'
];

const OPPORTUNITY_HEADERS = [
  'Opportunity ID', 'Status', 'Name', 'Description', 'Skill Tags',
  'Participation Tags', 'Service Format', 'Region', 'Minimum Weekly Hours',
  'Start Window', 'Supervisor', 'Sensitivity Level', 'Updated At'
];

const JOIEOS_HEADERS = [
  'Queue ID', 'Intake ID', 'Created At', 'Status', 'Bundle JSON',
  'Export Batch ID', 'Exported At', 'Imported At', 'Notes'
];

const AUDIT_HEADERS = [
  'Audit ID', 'Timestamp', 'Action', 'Actor', 'Intake ID', 'Details'
];

function doGet(e) {
  const mode = String((e && e.parameter && e.parameter.mode) || 'health');
  if (mode === 'health') {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, service: 'Food Aid Project Service Corps Network', version: FAP.VERSION }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutput('<!doctype html><html><body><h1>Food Aid Project Service Corps Network</h1><p>The intake service is available.</p></body></html>');
}

function doPost(e) {
  const response = { ok: false, intakeId: '', message: '' };
  try {
    const payload = normalizeRequest_(e);

    if (payload.website) {
      response.ok = true;
      response.message = 'Thank you.';
      return postMessageResponse_(response);
    }

    validatePayload_(payload);
    enforceRateLimit_(payload.email);

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      ensureWorkbook_();
      const intakeId = createIntakeId_();
      const submittedAt = new Date();
      const routing = classifySubmission_(payload);
      const matches = findOpportunityMatches_(payload, routing.tags);
      const nextReviewAt = calculateNextReview_(routing.priority, payload.deadline);

      appendIntake_(intakeId, submittedAt, payload, routing, matches, nextReviewAt);
      appendFollowUp_(intakeId, submittedAt, payload, routing, matches, nextReviewAt);
      appendJoieOSBundle_(intakeId, submittedAt, payload, routing, matches, nextReviewAt);
      appendAudit_('intake.received', 'public-web-form', intakeId, {
        routingTags: routing.tags,
        reviewPriority: routing.priority,
        suggestedMatches: matches.map(function(match) { return match.id; })
      });

      sendAcknowledgment_(intakeId, payload, routing);
      sendInternalNotification_(intakeId, payload, routing, matches, nextReviewAt);

      response.ok = true;
      response.intakeId = intakeId;
      response.message = 'Your questionnaire has been received.';
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    response.message = safePublicError_(error);
    try {
      appendAudit_('intake.error', 'public-web-form', '', { message: String(error && error.message || error) });
    } catch (auditError) {
      console.error(auditError);
    }
  }

  return postMessageResponse_(response);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Service Corps Network')
    .addItem('Initialize or repair workbook', 'installServiceCorpsNetwork')
    .addItem('Send due review reminders', 'sendReviewReminders')
    .addItem('Recalculate suggested matches', 'recalculateSuggestedMatches')
    .addSeparator()
    .addItem('Export pending JoieOS records', 'exportPendingJoieOSBundles')
    .addToUi();
}

function installServiceCorpsNetwork() {
  ensureWorkbook_();
  installDailyTrigger_();
  appendAudit_('system.installed', Session.getActiveUser().getEmail() || 'workspace-user', '', { version: FAP.VERSION });
  SpreadsheetApp.getUi().alert('Service Corps Network is initialized. Review Script Properties before deploying the web app.');
}

function sendReviewReminders() {
  ensureWorkbook_();
  const sheet = getSheet_(FAP.FOLLOW_UP_SHEET);
  const values = sheet.getDataRange().getValues();
  const header = indexHeaders_(values[0]);
  const now = new Date();
  const due = [];

  for (let row = 1; row < values.length; row += 1) {
    const item = values[row];
    const status = String(item[header['Status']] || '');
    const dueAt = asDate_(item[header['Due At']]);
    if (!dueAt || dueAt > now || ['COMPLETE', 'CANCELLED'].indexOf(status) !== -1) continue;

    due.push({
      row: row + 1,
      taskId: item[header['Task ID']],
      intakeId: item[header['Intake ID']],
      name: item[header['Person Name']],
      email: item[header['Person Email']],
      priority: item[header['Priority']],
      taskType: item[header['Task Type']],
      dueAt: dueAt,
      tags: item[header['Routing Tags']],
    });
  }

  if (!due.length) return;

  const body = [
    'The following Service Corps intake reviews are due:',
    '',
    due.map(function(item) {
      return '- ' + item.priority + ' — ' + item.name + ' (' + item.email + ') — ' + item.taskType + ' — due ' + formatDate_(item.dueAt) + ' — ' + item.intakeId;
    }).join('\n'),
    '',
    'Open the Service Corps Network spreadsheet to review and update these records.'
  ].join('\n');

  MailApp.sendEmail({
    to: getReviewEmail_(),
    subject: '[Service Corps] ' + due.length + ' intake review' + (due.length === 1 ? '' : 's') + ' due',
    body: body,
    name: 'Food Aid Project Service Corps'
  });

  due.forEach(function(item) {
    sheet.getRange(item.row, header['Last Reminder At'] + 1).setValue(now);
  });
  appendAudit_('reminders.sent', 'time-trigger', '', { count: due.length, taskIds: due.map(function(item) { return item.taskId; }) });
}

function recalculateSuggestedMatches() {
  ensureWorkbook_();
  const sheet = getSheet_(FAP.INTAKE_SHEET);
  const values = sheet.getDataRange().getValues();
  const header = indexHeaders_(values[0]);

  for (let row = 1; row < values.length; row += 1) {
    const item = values[row];
    const payload = {
      participation: splitList_(item[header['Participation']]),
      skillArea: splitList_(item[header['Skill Areas']]),
      skillsSummary: String(item[header['Skills Summary']] || ''),
      loveToDo: String(item[header['Love To Do']] || ''),
      serviceFormat: String(item[header['Service Format']] || ''),
      region: String(item[header['Region']] || ''),
      weeklyHours: String(item[header['Weekly Hours']] || ''),
      startTime: String(item[header['Start Time']] || ''),
    };
    const routing = classifySubmission_(payload);
    const matches = findOpportunityMatches_(payload, routing.tags);
    sheet.getRange(row + 1, header['Suggested Matches'] + 1).setValue(formatMatches_(matches));
  }

  appendAudit_('matches.recalculated', Session.getActiveUser().getEmail() || 'workspace-user', '', { rows: Math.max(values.length - 1, 0) });
}

function exportPendingJoieOSBundles() {
  ensureWorkbook_();
  const sheet = getSheet_(FAP.JOIEOS_SHEET);
  const values = sheet.getDataRange().getValues();
  const header = indexHeaders_(values[0]);
  const pending = [];
  const rowNumbers = [];

  for (let row = 1; row < values.length; row += 1) {
    const status = String(values[row][header['Status']] || '');
    if (status !== 'PENDING' && status !== 'EXPORTED') continue;
    try {
      pending.push(JSON.parse(String(values[row][header['Bundle JSON']] || '{}')));
      rowNumbers.push(row + 1);
    } catch (error) {
      appendAudit_('joieos.bundle.invalid', 'export', String(values[row][header['Intake ID']] || ''), { message: String(error.message || error) });
    }
  }

  if (!pending.length) {
    SpreadsheetApp.getUi().alert('No JoieOS records are waiting for export.');
    return;
  }

  const exportBatchId = 'JOIEOS-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const bundle = {
    schemaVersion: 'fap-service-corps-intake-v1',
    exportBatchId: exportBatchId,
    exportedAt: new Date().toISOString(),
    records: pending
  };

  const folder = getOrCreateExportFolder_();
  const file = folder.createFile(exportBatchId + '.json', JSON.stringify(bundle, null, 2), MimeType.PLAIN_TEXT);
  const now = new Date();
  rowNumbers.forEach(function(rowNumber) {
    sheet.getRange(rowNumber, header['Status'] + 1).setValue('EXPORTED');
    sheet.getRange(rowNumber, header['Export Batch ID'] + 1).setValue(exportBatchId);
    sheet.getRange(rowNumber, header['Exported At'] + 1).setValue(now);
  });

  appendAudit_('joieos.export.created', Session.getActiveUser().getEmail() || 'workspace-user', '', {
    exportBatchId: exportBatchId,
    count: pending.length,
    fileId: file.getId()
  });
  SpreadsheetApp.getUi().alert('JoieOS export created:\n' + file.getUrl());
}

function normalizeRequest_(e) {
  const parameters = (e && e.parameters) || {};
  const first = function(name) {
    const values = parameters[name];
    return values && values.length ? clean_(values[0]) : '';
  };
  const all = function(name) {
    const values = parameters[name] || [];
    return values.map(clean_).filter(Boolean);
  };

  return {
    fullName: first('fullName'),
    email: first('email').toLowerCase(),
    phone: first('phone'),
    contactMethod: first('contactMethod'),
    city: first('city'),
    region: first('region'),
    country: first('country'),
    adultStatus: first('adultStatus'),
    participation: all('participation'),
    hoursNeeded: first('hoursNeeded'),
    deadline: first('deadline'),
    jurisdiction: first('jurisdiction'),
    approvalStatus: first('approvalStatus'),
    authorityNotes: first('authorityNotes'),
    skillsSummary: first('skillsSummary'),
    loveToDo: first('loveToDo'),
    skillArea: all('skillArea'),
    relationships: first('relationships'),
    meaningful: first('meaningful'),
    outreachPlatform: all('outreachPlatform'),
    publicProfile: first('publicProfile'),
    audienceSize: first('audienceSize'),
    audienceDescription: first('audienceDescription'),
    contentFormats: first('contentFormats'),
    outreachIdeas: first('outreachIdeas'),
    serviceFormat: first('serviceFormat'),
    weeklyHours: first('weeklyHours'),
    startTime: first('startTime'),
    timeZone: first('timeZone'),
    schedule: first('schedule'),
    heardAbout: first('heardAbout'),
    referrer: first('referrer'),
    consentContact: first('consentContact') === 'on' || first('consentContact') === 'Yes',
    acknowledgeStatus: first('acknowledgeStatus') === 'on' || first('acknowledgeStatus') === 'Yes',
    acknowledgeSensitive: first('acknowledgeSensitive') === 'on' || first('acknowledgeSensitive') === 'Yes',
    updates: first('updates') === 'on' || first('updates') === 'Yes',
    sourceOrigin: first('sourceOrigin') || 'https://www.foodaidproject.org/service-corps.html',
    website: first('website')
  };
}

function validatePayload_(payload) {
  const required = ['fullName', 'email', 'contactMethod', 'city', 'region', 'country', 'adultStatus', 'skillsSummary', 'loveToDo', 'serviceFormat', 'weeklyHours', 'startTime'];
  const missing = required.filter(function(name) { return !payload[name]; });
  if (missing.length) throw new Error('MISSING_REQUIRED_FIELDS');
  if (!payload.participation.length) throw new Error('MISSING_PARTICIPATION');
  if (!payload.consentContact || !payload.acknowledgeStatus || !payload.acknowledgeSensitive) throw new Error('MISSING_CONSENT');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new Error('INVALID_EMAIL');
  if (payload.fullName.length > 100 || payload.email.length > 160) throw new Error('INVALID_LENGTH');

  const allowedOrigins = getProperty_('ALLOWED_ORIGINS', 'https://www.foodaidproject.org,https://foodaidproject.org');
  const origins = allowedOrigins.split(',').map(function(value) { return value.trim(); }).filter(Boolean);
  if (payload.sourceOrigin && origins.length && !origins.some(function(origin) { return payload.sourceOrigin.indexOf(origin) === 0; })) {
    throw new Error('INVALID_SOURCE');
  }
}

function classifySubmission_(payload) {
  const tags = [];
  const flags = [];
  let score = 20;

  const participation = payload.participation || [];
  if (includesPrefix_(participation, 'Court')) {
    tags.push('community-service-interest');
    flags.push('authority-approval-required');
    score += 20;
  }
  if (includesPrefix_(participation, 'Professional')) tags.push('skills-volunteer');
  if (includesPrefix_(participation, 'Mission')) tags.push('ambassador-connector');
  if (includesPrefix_(participation, 'Mentor')) tags.push('mentor-supervisor');
  if (includesPrefix_(participation, 'Attorney')) tags.push('referral-professional');
  if (includesPrefix_(participation, 'Business')) tags.push('organization-partner');
  if (includesPrefix_(participation, 'General')) tags.push('general-volunteer');
  if (includesPrefix_(participation, 'Other')) tags.push('other-interest');

  if ((payload.skillArea || []).length >= 3) score += 10;
  if (String(payload.relationships || '').length >= 80) score += 5;
  if (['6–10 hours', '11–20 hours', 'More than 20 hours'].indexOf(payload.weeklyHours) !== -1) score += 5;
  if (payload.startTime === 'Immediately') score += 5;
  if (payload.adultStatus === 'No') flags.push('minor-guardian-review');
  if (payload.approvalStatus === 'I need Food Aid Project information for approval') flags.push('approval-packet-requested');
  if (payload.approvalStatus === 'I am not sure') flags.push('approval-status-unclear');

  const deadline = asDate_(payload.deadline);
  if (deadline) {
    const days = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
    if (days <= 14) {
      score += 35;
      flags.push('deadline-within-14-days');
    } else if (days <= 30) {
      score += 20;
      flags.push('deadline-within-30-days');
    } else if (days <= 60) {
      score += 10;
    }
  }

  if (!tags.length) tags.push('future-network');
  if (payload.startTime === 'I am joining the future-interest network') tags.push('future-network');

  const priority = score >= 70 ? 'URGENT' : score >= 50 ? 'HIGH' : score >= 30 ? 'NORMAL' : 'LOW';
  return {
    tags: unique_(tags),
    flags: unique_(flags),
    score: score,
    priority: priority
  };
}

function findOpportunityMatches_(payload, routingTags) {
  const sheet = getSheet_(FAP.OPPORTUNITIES_SHEET);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = indexHeaders_(values[0]);
  const personSkills = normalizeTokens_((payload.skillArea || []).concat([payload.skillsSummary || '', payload.loveToDo || '']));
  const personTags = normalizeTokens_(routingTags || []);
  const matches = [];

  for (let row = 1; row < values.length; row += 1) {
    const item = values[row];
    if (String(item[header['Status']] || '').toUpperCase() !== 'OPEN') continue;

    const opportunitySkills = normalizeTokens_(splitList_(item[header['Skill Tags']]));
    const opportunityTags = normalizeTokens_(splitList_(item[header['Participation Tags']]));
    let score = overlapCount_(personSkills, opportunitySkills) * 10;
    score += overlapCount_(personTags, opportunityTags) * 15;

    const format = String(item[header['Service Format']] || '');
    if (!format || format === 'Any' || format === payload.serviceFormat || payload.serviceFormat === 'Either remote or in person') score += 5;

    const region = String(item[header['Region']] || '');
    if (!region || region === 'Any' || region.toLowerCase() === String(payload.region || '').toLowerCase()) score += 5;

    if (score > 0) {
      matches.push({
        id: String(item[header['Opportunity ID']] || ''),
        name: String(item[header['Name']] || ''),
        score: score
      });
    }
  }

  return matches.sort(function(a, b) { return b.score - a.score; }).slice(0, 3);
}

function appendIntake_(intakeId, submittedAt, payload, routing, matches, nextReviewAt) {
  appendMappedRow_(getSheet_(FAP.INTAKE_SHEET), INTAKE_HEADERS, {
    'Intake ID': intakeId,
    'Submitted At': submittedAt,
    'Status': 'NEW',
    'Review Priority': routing.priority,
    'Priority Score': routing.score,
    'Routing Tags': routing.tags.join(', '),
    'Review Flags': routing.flags.join(', '),
    'Suggested Matches': formatMatches_(matches),
    'Full Name': payload.fullName,
    'Email': payload.email,
    'Phone': payload.phone,
    'Preferred Contact': payload.contactMethod,
    'City': payload.city,
    'Region': payload.region,
    'Country': payload.country,
    'Adult Status': payload.adultStatus,
    'Participation': payload.participation.join('; '),
    'Hours Needed': payload.hoursNeeded,
    'Deadline': payload.deadline,
    'Jurisdiction': payload.jurisdiction,
    'Approval Status': payload.approvalStatus,
    'Authority Notes': payload.authorityNotes,
    'Skills Summary': payload.skillsSummary,
    'Love To Do': payload.loveToDo,
    'Skill Areas': payload.skillArea.join('; '),
    'Relationships and Audiences': payload.relationships,
    'Meaningful Service': payload.meaningful,
    'Outreach Platforms': payload.outreachPlatform.join('; '),
    'Public Profile': payload.publicProfile,
    'Audience Size': payload.audienceSize,
    'Audience Description': payload.audienceDescription,
    'Content Formats': payload.contentFormats,
    'Outreach Ideas': payload.outreachIdeas,
    'Service Format': payload.serviceFormat,
    'Weekly Hours': payload.weeklyHours,
    'Start Time': payload.startTime,
    'Time Zone': payload.timeZone,
    'Schedule': payload.schedule,
    'Heard About': payload.heardAbout,
    'Referrer': payload.referrer,
    'Consent Contact': payload.consentContact ? 'Yes' : 'No',
    'Consent Updates': payload.updates ? 'Yes' : 'No',
    'Sensitive Info Acknowledged': payload.acknowledgeSensitive ? 'Yes' : 'No',
    'No Credit Guarantee Acknowledged': payload.acknowledgeStatus ? 'Yes' : 'No',
    'Source Origin': payload.sourceOrigin,
    'Last Contact At': '',
    'Next Review At': nextReviewAt,
    'Assigned To': '',
    'Internal Notes': '',
    'Record Version': FAP.VERSION
  });
}

function appendFollowUp_(intakeId, submittedAt, payload, routing, matches, nextReviewAt) {
  const taskId = 'TASK-' + intakeId;
  getSheet_(FAP.FOLLOW_UP_SHEET).appendRow([
    taskId, intakeId, submittedAt, nextReviewAt, 'OPEN', routing.priority,
    'INITIAL_REVIEW', getReviewEmail_(), payload.fullName, payload.email,
    routing.tags.join(', '), formatMatches_(matches), '', '', ''
  ]);
}

function appendJoieOSBundle_(intakeId, submittedAt, payload, routing, matches, nextReviewAt) {
  const personId = 'person-service-corps-' + slug_(intakeId);
  const conversationId = 'conversation-service-corps-' + slug_(intakeId);
  const commitmentId = 'commitment-service-corps-review-' + slug_(intakeId);
  const eventTime = submittedAt.toISOString();

  const bundle = {
    intakeId: intakeId,
    sourceSystem: 'fap-service-corps-network',
    schemaVersion: 'fap-service-corps-intake-v1',
    objects: [
      {
        objectId: personId,
        objectType: 'Person',
        name: payload.fullName,
        status: 'prospective-network-member',
        attentionState: routing.priority === 'URGENT' ? 'Needs Approval' : 'Watching',
        owner: FAP.OWNER_ID,
        workspace: FAP.WORKSPACE_ID,
        visibility: 'private',
        source: 'service-corps-intake',
        evidence: ['Service Corps intake ' + intakeId],
        createdAt: eventTime,
        description: buildPersonDescription_(payload, routing, matches)
      },
      {
        objectId: conversationId,
        objectType: 'Conversation',
        name: 'Service Corps intake — ' + payload.fullName,
        status: 'new-intake',
        attentionState: routing.priority === 'URGENT' ? 'Needs Approval' : 'Active',
        owner: FAP.OWNER_ID,
        workspace: FAP.WORKSPACE_ID,
        visibility: 'private',
        source: 'service-corps-intake',
        evidence: ['Service Corps intake ' + intakeId],
        createdAt: eventTime,
        description: 'Routing: ' + routing.tags.join(', ') + '. Review flags: ' + (routing.flags.join(', ') || 'none') + '. Suggested matches: ' + (formatMatches_(matches) || 'none') + '.'
      },
      {
        objectId: commitmentId,
        objectType: 'Commitment',
        name: 'Review Service Corps intake — ' + payload.fullName,
        status: 'open',
        attentionState: routing.priority === 'URGENT' ? 'Needs Approval' : 'Active',
        owner: FAP.OWNER_ID,
        workspace: FAP.WORKSPACE_ID,
        visibility: 'private',
        source: 'service-corps-intake',
        evidence: ['Service Corps intake ' + intakeId],
        createdAt: eventTime,
        description: 'Initial review due ' + new Date(nextReviewAt).toISOString() + '. Priority: ' + routing.priority + '. No placement or hour approval is implied.'
      }
    ],
    relationships: [
      relationship_(intakeId + '-person-program', personId, 'interested-in', FAP.PROGRAM_ID, eventTime),
      relationship_(intakeId + '-conversation-program', conversationId, 'part-of', FAP.PROGRAM_ID, eventTime),
      relationship_(intakeId + '-conversation-person', conversationId, 'involves', personId, eventTime),
      relationship_(intakeId + '-review-conversation', commitmentId, 'part-of', conversationId, eventTime)
    ],
    events: [
      {
        eventId: 'event-service-corps-intake-' + slug_(intakeId),
        eventType: 'service-corps.intake.received',
        actorObjectId: personId,
        targetObjectId: conversationId,
        workspace: FAP.WORKSPACE_ID,
        timestamp: eventTime,
        source: 'service-corps-intake',
        evidence: ['Service Corps intake ' + intakeId],
        summary: 'Service Corps interest questionnaire received from ' + payload.fullName + '.',
        immutable: true
      }
    ]
  };

  getSheet_(FAP.JOIEOS_SHEET).appendRow([
    'QUEUE-' + intakeId, intakeId, submittedAt, 'PENDING', JSON.stringify(bundle), '', '', '', ''
  ]);
}

function sendAcknowledgment_(intakeId, payload, routing) {
  const subject = 'We received your Food Aid Project Service Corps questionnaire';
  const body = [
    'Hello ' + payload.fullName + ',',
    '',
    'Thank you for telling us what you know, what you do well, and what you already love to do.',
    '',
    'Your reference number is ' + intakeId + '.',
    '',
    'Food Aid Project will review your questionnaire for possible volunteer, community-service, professional-service, ambassador, mentoring, referral, or partnership opportunities. We may contact you when we identify an appropriate next step or future match.',
    '',
    'Important: this acknowledgment is not acceptance into a placement and does not approve or begin community-service hours. Court- or agency-related hours may begin only after Food Aid Project and the applicable supervising authority approve a written service plan.',
    '',
    'Please do not email sensitive legal, medical, identity, or financial information unless Food Aid Project gives you a separately approved method for doing so.',
    '',
    'Food Aid Project, Inc.',
    'info@foodaidproject.org',
    'https://www.foodaidproject.org/'
  ].join('\n');

  MailApp.sendEmail({
    to: payload.email,
    replyTo: getReviewEmail_(),
    subject: subject,
    body: body,
    name: 'Food Aid Project Service Corps'
  });
}

function sendInternalNotification_(intakeId, payload, routing, matches, nextReviewAt) {
  const subject = '[Service Corps ' + routing.priority + '] ' + payload.fullName + ' — ' + routing.tags.join(', ');
  const body = [
    'A new Service Corps questionnaire has been received.',
    '',
    'Reference: ' + intakeId,
    'Name: ' + payload.fullName,
    'Email: ' + payload.email,
    'Location: ' + [payload.city, payload.region, payload.country].filter(Boolean).join(', '),
    'Priority: ' + routing.priority + ' (' + routing.score + ')',
    'Routing: ' + routing.tags.join(', '),
    'Review flags: ' + (routing.flags.join(', ') || 'none'),
    'Suggested matches: ' + (formatMatches_(matches) || 'none'),
    'Review due: ' + formatDate_(nextReviewAt),
    '',
    'Participation: ' + payload.participation.join('; '),
    'Skills: ' + payload.skillArea.join('; '),
    'Especially good at: ' + payload.skillsSummary,
    'Loves to do: ' + payload.loveToDo,
    'Availability: ' + payload.weeklyHours + '; ' + payload.serviceFormat + '; ' + payload.startTime,
    '',
    'Review the complete record in the Service Corps Network spreadsheet. Do not treat this message as approval of a placement or service hours.'
  ].join('\n');

  MailApp.sendEmail({
    to: getReviewEmail_(),
    replyTo: payload.email,
    subject: subject,
    body: body,
    name: 'Food Aid Project Service Corps Network'
  });
}

function ensureWorkbook_() {
  const spreadsheet = getSpreadsheet_();
  ensureSheet_(spreadsheet, FAP.INTAKE_SHEET, INTAKE_HEADERS);
  ensureSheet_(spreadsheet, FAP.FOLLOW_UP_SHEET, FOLLOW_UP_HEADERS);
  ensureSheet_(spreadsheet, FAP.OPPORTUNITIES_SHEET, OPPORTUNITY_HEADERS);
  ensureSheet_(spreadsheet, FAP.JOIEOS_SHEET, JOIEOS_HEADERS);
  ensureSheet_(spreadsheet, FAP.AUDIT_SHEET, AUDIT_HEADERS);
}

function getSpreadsheet_() {
  const id = getProperty_('SPREADSHEET_ID', '');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('SPREADSHEET_NOT_CONFIGURED');
  return active;
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3e2d2');
    sheet.autoResizeColumns(1, headers.length);
  } else {
    assertHeaders_(sheet, headers);
  }
  return sheet;
}

function appendMappedRow_(sheet, requiredHeaders, record) {
  assertHeaders_(sheet, requiredHeaders);
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) { return String(value); });
  const row = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
  });
  sheet.appendRow(row);
}

function assertHeaders_(sheet, requiredHeaders) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) throw new Error('SCHEMA_MISMATCH_' + sheet.getName() + '_NO_HEADERS');
  const actual = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) { return String(value).trim(); });
  const missing = requiredHeaders.filter(function(header) { return actual.indexOf(header) === -1; });
  const duplicates = actual.filter(function(header, index) { return header && actual.indexOf(header) !== index; });
  if (missing.length || duplicates.length) {
    throw new Error('SCHEMA_MISMATCH_' + sheet.getName() + '_MISSING_' + missing.join('|') + '_DUPLICATE_' + unique_(duplicates).join('|'));
  }
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('MISSING_SHEET_' + name);
  return sheet;
}

function installDailyTrigger_() {
  const handler = 'sendReviewReminders';
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) { return trigger.getHandlerFunction() === handler; });
  if (!exists) ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(8).create();
}

function calculateNextReview_(priority, deadlineValue) {
  const now = new Date();
  const hours = priority === 'URGENT' ? 4 : priority === 'HIGH' ? 24 : priority === 'NORMAL' ? 72 : 168;
  const proposed = new Date(now.getTime() + hours * 3600000);
  const deadline = asDate_(deadlineValue);
  if (deadline && deadline < proposed) return new Date(Math.max(now.getTime() + 3600000, deadline.getTime() - 86400000));
  return proposed;
}

function relationship_(suffix, fromId, type, toId, createdAt) {
  return {
    relationshipId: 'rel-service-corps-' + slug_(suffix),
    fromObjectId: fromId,
    relationshipType: type,
    toObjectId: toId,
    strength: 'moderate',
    confidence: 'confirmed',
    source: 'service-corps-intake',
    state: 'active',
    createdAt: createdAt
  };
}

function buildPersonDescription_(payload, routing, matches) {
  return [
    'Service Corps intake. Email: ' + payload.email + '.',
    'Location: ' + [payload.city, payload.region, payload.country].filter(Boolean).join(', ') + '.',
    'Participation: ' + payload.participation.join('; ') + '.',
    'Skills: ' + payload.skillArea.join('; ') + '.',
    'Loves to do: ' + payload.loveToDo + '.',
    'Routing: ' + routing.tags.join(', ') + '.',
    'Suggested matches: ' + (formatMatches_(matches) || 'none') + '.',
    'Consent for general updates: ' + (payload.updates ? 'yes' : 'no') + '.'
  ].join(' ');
}

function appendAudit_(action, actor, intakeId, details) {
  ensureWorkbook_();
  getSheet_(FAP.AUDIT_SHEET).appendRow([
    'AUDIT-' + Utilities.getUuid(), new Date(), action, actor, intakeId, JSON.stringify(details || {})
  ]);
}

function enforceRateLimit_(email) {
  const cache = CacheService.getScriptCache();
  const key = 'rate-' + digest_(email + '-' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH'));
  const current = Number(cache.get(key) || '0');
  if (current >= 3) throw new Error('RATE_LIMIT');
  cache.put(key, String(current + 1), 3600);
}

function postMessageResponse_(response) {
  const safe = JSON.stringify(response).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><body><script>' +
    'parent.postMessage(' + safe + ', "*");' +
    '</script><p>' + escapeHtml_(response.message || 'Thank you.') + '</p></body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function safePublicError_(error) {
  const code = String(error && error.message || error);
  if (code === 'RATE_LIMIT') return 'Too many attempts were received. Please wait and try again.';
  if (code.indexOf('MISSING_') === 0 || code === 'INVALID_EMAIL' || code === 'INVALID_LENGTH') return 'Please review the required fields and try again.';
  if (code === 'INVALID_SOURCE') return 'This form could not be verified. Please use the questionnaire at foodaidproject.org.';
  return 'We could not save the questionnaire. Please use the email fallback or contact info@foodaidproject.org.';
}

function getReviewEmail_() {
  return getProperty_('REVIEW_EMAIL', FAP.DEFAULT_REVIEW_EMAIL);
}

function getOrCreateExportFolder_() {
  const folderId = getProperty_('JOIEOS_EXPORT_FOLDER_ID', '');
  if (folderId) return DriveApp.getFolderById(folderId);
  const folders = DriveApp.getFoldersByName('Food Aid Project Service Corps JoieOS Exports');
  return folders.hasNext() ? folders.next() : DriveApp.createFolder('Food Aid Project Service Corps JoieOS Exports');
}

function getProperty_(name, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  return value === null || value === '' ? fallback : value;
}

function createIntakeId_() {
  return 'FAP-SC-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function indexHeaders_(headers) {
  return headers.reduce(function(map, value, index) { map[String(value)] = index; return map; }, {});
}

function clean_(value) {
  return String(value == null ? '' : value).replace(/\u0000/g, '').trim();
}

function splitList_(value) {
  return String(value || '').split(/[;,]/).map(clean_).filter(Boolean);
}

function unique_(values) {
  return values.filter(function(value, index) { return values.indexOf(value) === index; });
}

function includesPrefix_(values, prefix) {
  return (values || []).some(function(value) { return String(value).indexOf(prefix) === 0; });
}

function asDate_(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function formatDate_(value) {
  const date = asDate_(value);
  return date ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm z') : '';
}

function formatMatches_(matches) {
  return (matches || []).map(function(match) { return match.name + ' [' + match.id + '; score ' + match.score + ']'; }).join('; ');
}

function normalizeTokens_(values) {
  const words = [];
  (values || []).forEach(function(value) {
    String(value || '').toLowerCase().split(/[^a-z0-9]+/).forEach(function(word) {
      if (word.length >= 3) words.push(word);
    });
  });
  return unique_(words);
}

function overlapCount_(left, right) {
  const set = {};
  left.forEach(function(value) { set[value] = true; });
  return right.reduce(function(total, value) { return total + (set[value] ? 1 : 0); }, 0);
}

function slug_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function digest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)
    .map(function(byte) { return (byte + 256).toString(16).slice(-2); })
    .join('');
}

function escapeHtml_(value) {
  return String(value || '').replace(/[&<>"']/g, function(char) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
  });
}
