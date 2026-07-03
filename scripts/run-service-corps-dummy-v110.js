const fs = require('fs');
const path = require('path');

const config = fs.readFileSync(path.join(process.cwd(), 'service-corps-config.js'), 'utf8');
const match = config.match(/endpoint:\s*['"]([^'"]+)['"]/);
if (!match) throw new Error('Service Corps endpoint not found');

const payload = new URLSearchParams();
const fields = {
  fullName: 'SERVICE CORPS TEST 2 — DELETE',
  email: 'info+schema-test2@foodaidproject.org',
  phone: 'TEST 2 ONLY',
  contactMethod: 'Email',
  city: 'TEST CITY 2',
  region: 'TEST REGION 2',
  country: 'United States',
  adultStatus: 'Yes',
  participation: 'General volunteer',
  skillsSummary: 'TEST 2 ONLY — corrected schema verification',
  loveToDo: 'TEST 2 ONLY — support Food Aid Project outreach',
  relationships: 'TEST 2 RELATIONSHIPS',
  meaningful: 'TEST 2 MEANINGFUL',
  publicProfile: 'https://example.org/test-2',
  audienceSize: '2,500–9,999',
  audienceDescription: 'TEST 2 AUDIENCE',
  contentFormats: 'TEST 2 FORMATS',
  outreachIdeas: 'TEST 2 IDEAS',
  serviceFormat: 'Remote',
  weeklyHours: '3–5 hours',
  startTime: 'Within 30 days',
  timeZone: 'Mountain Time',
  schedule: 'TEST 2 SCHEDULE',
  heardAbout: 'Controlled schema test',
  referrer: 'ChatGPT verification',
  consentContact: 'Yes',
  acknowledgeStatus: 'Yes',
  acknowledgeSensitive: 'Yes',
  updates: 'Yes',
  sourceOrigin: 'https://www.foodaidproject.org/service-corps.html'
};
for (const [key, value] of Object.entries(fields)) payload.append(key, value);
for (const value of [
  'Communications, public speaking, media, or storytelling',
  'Outreach, social media, influencer engagement, or digital content'
]) payload.append('skillArea', value);
for (const value of ['LinkedIn', 'YouTube']) payload.append('outreachPlatform', value);

fetch(match[1], {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: payload.toString(),
  redirect: 'follow'
}).then(async response => {
  const text = await response.text();
  console.log(text);
  if (!response.ok || !text.includes('Your questionnaire has been received.')) {
    throw new Error('Dummy submission was not accepted');
  }
}).catch(error => {
  console.error(error);
  process.exit(1);
});
