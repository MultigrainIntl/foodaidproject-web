from pathlib import Path

root = Path('.')
code_path = root / 'apps-script/service-corps-network/Code.gs'
config_path = root / 'service-corps-config.js'
validator_path = root / 'scripts/validate-site.py'
test_path = root / 'scripts/validate-service-corps-schema.js'

code = code_path.read_text(encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

code = replace_once(code, "VERSION: '1.0.0'", "VERSION: '1.1.0'", 'version')

old_headers = """const INTAKE_HEADERS = [
  'Intake ID', 'Submitted At', 'Status', 'Review Priority', 'Priority Score',
  'Routing Tags', 'Review Flags', 'Suggested Matches', 'Full Name', 'Email',
  'Phone', 'Preferred Contact', 'City', 'Region', 'Country', 'Adult Status',
  'Participation', 'Hours Needed', 'Deadline', 'Jurisdiction', 'Approval Status',
  'Authority Notes', 'Skills Summary', 'Love To Do', 'Skill Areas',
  'Relationships', 'Meaningful Service', 'Service Format', 'Weekly Hours',
  'Start Time', 'Schedule', 'Travel', 'Heard About', 'Referrer',
  'Consent Contact', 'Consent Updates', 'Sensitive Info Acknowledged',
  'No Credit Guarantee Acknowledged', 'Source Origin', 'Last Contact At',
  'Next Review At', 'Assigned To', 'Internal Notes', 'Record Version'
];"""
new_headers = """const INTAKE_HEADERS = [
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
];"""
code = replace_once(code, old_headers, new_headers, 'intake headers')

old_normalize = """    relationships: first('relationships'),
    meaningful: first('meaningful'),
    serviceFormat: first('serviceFormat'),
    weeklyHours: first('weeklyHours'),
    startTime: first('startTime'),
    schedule: first('schedule'),
    travel: first('travel'),
    heardAbout: first('heardAbout'),"""
new_normalize = """    relationships: first('relationships'),
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
    heardAbout: first('heardAbout'),"""
code = replace_once(code, old_normalize, new_normalize, 'request normalization')

old_append = """function appendIntake_(intakeId, submittedAt, payload, routing, matches, nextReviewAt) {
  const sheet = getSheet_(FAP.INTAKE_SHEET);
  sheet.appendRow([
    intakeId, submittedAt, 'NEW', routing.priority, routing.score,
    routing.tags.join(', '), routing.flags.join(', '), formatMatches_(matches), payload.fullName, payload.email,
    payload.phone, payload.contactMethod, payload.city, payload.region, payload.country, payload.adultStatus,
    payload.participation.join('; '), payload.hoursNeeded, payload.deadline, payload.jurisdiction, payload.approvalStatus,
    payload.authorityNotes, payload.skillsSummary, payload.loveToDo, payload.skillArea.join('; '),
    payload.relationships, payload.meaningful, payload.serviceFormat, payload.weeklyHours,
    payload.startTime, payload.schedule, payload.travel, payload.heardAbout, payload.referrer,
    payload.consentContact ? 'Yes' : 'No', payload.updates ? 'Yes' : 'No', payload.acknowledgeSensitive ? 'Yes' : 'No',
    payload.acknowledgeStatus ? 'Yes' : 'No', payload.sourceOrigin, '', nextReviewAt, '', '', FAP.VERSION
  ]);
}"""
new_append = """function appendIntake_(intakeId, submittedAt, payload, routing, matches, nextReviewAt) {
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
}"""
code = replace_once(code, old_append, new_append, 'intake writer')

old_ensure = """function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3e2d2');
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}"""
new_ensure = """function ensureSheet_(spreadsheet, name, headers) {
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
}"""
code = replace_once(code, old_ensure, new_ensure, 'schema guard')
code_path.write_text(code, encoding='utf-8')

config_path.write_text("""/*
 * Food Aid Project Service Corps public configuration.
 *
 * This public file may contain only the approved Apps Script web-app endpoint
 * and response origins. Never place a spreadsheet ID, API key, token,
 * respondent data, or any other secret here.
 */
window.FAP_SERVICE_CORPS_CONFIG = Object.freeze({
  endpoint: 'https://script.google.com/macros/s/AKfycbzVIx_2Qc0w9f4ch7b3uo-n8Krs86r4_DAAT8CPhwkfCGpsA3WryOApucfUp9n9eqou/exec',
  responseOrigins: [
    'https://script.google.com',
    'https://script.googleusercontent.com'
  ]
});
""", encoding='utf-8')

test_path.write_text(r"""const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps-script/service-corps-network/Code.gs'), 'utf8');
const context = { console, Object, JSON, Date, Math, String, Number, Array, RegExp, isNaN };
vm.createContext(context);
vm.runInContext(source, context);
const headers = vm.runInContext('INTAKE_HEADERS.slice()', context);
if (headers.length !== 50) throw new Error(`Expected 50 Intake headers, got ${headers.length}`);
let appended = null;
const sheet = { getName: () => 'Intake', getLastColumn: () => headers.length, getRange: () => ({ getValues: () => [headers] }), appendRow: (row) => { appended = row; } };
context.getSheet_ = () => sheet;
const payload = {
  fullName: 'NAME', email: 'EMAIL', phone: 'PHONE', contactMethod: 'CONTACT', city: 'CITY', region: 'REGION', country: 'COUNTRY', adultStatus: 'ADULT',
  participation: ['PARTICIPATION'], hoursNeeded: 'HOURS_NEEDED', deadline: 'DEADLINE', jurisdiction: 'JURISDICTION', approvalStatus: 'APPROVAL', authorityNotes: 'AUTHORITY',
  skillsSummary: 'SKILLS', loveToDo: 'LOVE', skillArea: ['SKILL_A', 'SKILL_B'], relationships: 'RELATIONSHIPS', meaningful: 'MEANINGFUL',
  outreachPlatform: ['LINKEDIN', 'YOUTUBE'], publicProfile: 'PROFILE', audienceSize: 'AUDIENCE_SIZE', audienceDescription: 'AUDIENCE_DESCRIPTION', contentFormats: 'CONTENT_FORMATS', outreachIdeas: 'OUTREACH_IDEAS',
  serviceFormat: 'REMOTE', weeklyHours: 'WEEKLY', startTime: 'START', timeZone: 'TIMEZONE', schedule: 'SCHEDULE', heardAbout: 'HEARD', referrer: 'REFERRER',
  consentContact: true, updates: false, acknowledgeSensitive: true, acknowledgeStatus: true, sourceOrigin: 'SOURCE'
};
const routing = { priority: 'NORMAL', score: 40, tags: ['TAG'], flags: ['FLAG'] };
context.appendIntake_('INTAKE', new Date('2026-07-03T00:00:00Z'), payload, routing, [{ name: 'MATCH', id: 'ID', score: 10 }], new Date('2026-07-06T00:00:00Z'));
if (!appended || appended.length !== 50) throw new Error(`Expected 50 Intake values, got ${appended && appended.length}`);
const row = Object.fromEntries(headers.map((header, index) => [header, appended[index]]));
const expected = {
  'Relationships and Audiences': 'RELATIONSHIPS', 'Meaningful Service': 'MEANINGFUL', 'Outreach Platforms': 'LINKEDIN; YOUTUBE',
  'Public Profile': 'PROFILE', 'Audience Size': 'AUDIENCE_SIZE', 'Audience Description': 'AUDIENCE_DESCRIPTION', 'Content Formats': 'CONTENT_FORMATS',
  'Outreach Ideas': 'OUTREACH_IDEAS', 'Service Format': 'REMOTE', 'Weekly Hours': 'WEEKLY', 'Start Time': 'START', 'Time Zone': 'TIMEZONE',
  'Schedule': 'SCHEDULE', 'Heard About': 'HEARD', 'Referrer': 'REFERRER', 'Consent Contact': 'Yes', 'Consent Updates': 'No',
  'Sensitive Info Acknowledged': 'Yes', 'No Credit Guarantee Acknowledged': 'Yes', 'Source Origin': 'SOURCE', 'Record Version': '1.1.0'
};
for (const [header, value] of Object.entries(expected)) if (row[header] !== value) throw new Error(`${header}: expected ${value}, got ${row[header]}`);
const normalized = context.normalizeRequest_({ parameters: {
  fullName: ['NAME'], email: ['TEST@EXAMPLE.ORG'], contactMethod: ['Email'], city: ['CITY'], region: ['REGION'], country: ['COUNTRY'], adultStatus: ['Yes'], participation: ['General volunteer'],
  skillsSummary: ['SKILLS'], loveToDo: ['LOVE'], skillArea: ['A', 'B'], relationships: ['REL'], meaningful: ['MEAN'], outreachPlatform: ['LinkedIn', 'YouTube'], publicProfile: ['PROFILE'], audienceSize: ['SIZE'], audienceDescription: ['DESC'], contentFormats: ['FORMATS'], outreachIdeas: ['IDEAS'], serviceFormat: ['Remote'], weeklyHours: ['1–2 hours'], startTime: ['Immediately'], timeZone: ['Mountain Time'], schedule: ['Evenings'], heardAbout: ['Web'], referrer: ['Friend'], consentContact: ['on'], acknowledgeStatus: ['on'], acknowledgeSensitive: ['on'], updates: ['on'], sourceOrigin: ['https://www.foodaidproject.org/service-corps.html']
}});
if (normalized.outreachPlatform.join('|') !== 'LinkedIn|YouTube') throw new Error('Outreach-platform normalization failed');
if (normalized.timeZone !== 'Mountain Time') throw new Error('Time-zone normalization failed');
if (!normalized.consentContact || !normalized.acknowledgeStatus || !normalized.acknowledgeSensitive || !normalized.updates) throw new Error('Consent normalization failed');
console.log('Service Corps schema mapping: PASS');
""", encoding='utf-8')

validator = validator_path.read_text(encoding='utf-8')
validator = replace_once(validator, '"service-corps-config.js": ["endpoint:", "responseOrigins", "outreachAdapted"],', '"service-corps-config.js": ["endpoint:", "responseOrigins"],', 'validator config requirements')
validator = replace_once(validator, '            "sendReviewReminders",\n        ],', '            "sendReviewReminders",\n            "Relationships and Audiences",\n            "Outreach Platforms",\n            "publicProfile",\n            "appendMappedRow_",\n            "SCHEMA_MISMATCH_",\n        ],', 'validator Code.gs requirements')
validator = replace_once(
    validator,
    '    apps_script = ROOT / "apps-script/service-corps-network/Code.gs"\n    if apps_script.is_file():\n        check_javascript(apps_script.read_text(encoding="utf-8"), "Code.gs syntax", failures)\n',
    '    if "outreachAdapted" in config:\n        failures.append("service-corps-config.js: legacy outreach compatibility adapter must be removed")\n\n    apps_script = ROOT / "apps-script/service-corps-network/Code.gs"\n    if apps_script.is_file():\n        check_javascript(apps_script.read_text(encoding="utf-8"), "Code.gs syntax", failures)\n\n    schema_test = ROOT / "scripts/validate-service-corps-schema.js"\n    if not schema_test.is_file():\n        failures.append("missing required file: scripts/validate-service-corps-schema.js")\n    else:\n        result = subprocess.run(["node", str(schema_test)], capture_output=True, text=True)\n        if result.returncode:\n            failures.append(f"Service Corps schema mapping: {result.stderr.strip() or result.stdout.strip()}")\n',
    'validator schema test',
)
validator_path.write_text(validator, encoding='utf-8')
print('Applied Service Corps schema repair 1.1.0')
