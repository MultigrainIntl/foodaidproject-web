const fs = require('fs');
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
