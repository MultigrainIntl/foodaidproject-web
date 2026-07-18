import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseUrl = process.env.SITE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.SCREENSHOT_DIR || 'artifacts/site-proof';

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Service Corps', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Skills for Food Security Service Corps' }).waitFor();
  await page.screenshot({ path: `${outputDir}/homepage-desktop.png`, fullPage: true });

  await page.locator('a[href="/service-corps.html"]').filter({ hasText: /Join the interest network|Service Corps/i }).last().click();
  await page.waitForURL(/service-corps\.html/);
  await page.getByRole('heading', { name: 'The hours are yours.' }).waitFor();
  await page.getByText('Remote-only operating model:').waitFor();
  await page.getByRole('group', { name: '4. Outreach, social media, and influence' }).waitFor();

  const serviceFormat = await page.locator('input[name="serviceFormat"]').getAttribute('value');
  if (serviceFormat !== 'Remote') throw new Error('Service Corps must be remote-only.');
  if (await page.getByText('Either remote or in person', { exact: true }).count()) {
    throw new Error('In-person service option must not be present.');
  }
  if (await page.getByText(/food processing, packing, warehouse shifts/i).count() === 0) {
    throw new Error('Remote-only operating boundary is missing.');
  }

  const courtFields = page.locator('#court-fields');
  if (await courtFields.getAttribute('aria-hidden') !== 'true') throw new Error('Court fields should be hidden initially.');
  await page.locator('#court-service').check();
  if (await courtFields.getAttribute('aria-hidden') !== 'false') throw new Error('Court fields should open when selected.');

  await page.locator('#outreach-service').check();
  await page.locator('#full-name').fill('Test Participant');
  await page.locator('#email').fill('test@example.com');
  await page.locator('#contact-method').selectOption({ label: 'Email' });
  await page.locator('#city').fill('Fort Collins');
  await page.locator('#region').fill('Colorado');
  await page.locator('#country').fill('United States');
  await page.locator('#adult-status').selectOption({ label: 'Yes' });
  await page.locator('#hours-needed').fill('40');
  await page.locator('#jurisdiction').fill('Northern Colorado');
  await page.locator('#approval-status').selectOption({ label: 'I have not asked the supervising authority yet' });
  await page.locator('#skills-summary').fill('Outreach strategy, relationship development, project planning, and research.');
  await page.locator('#love-to-do').fill('Create useful content, connect people, and explain meaningful work.');
  await page.locator('input[name="skillArea"][value="Outreach, social media, influencer engagement, or digital content"]').check();
  await page.locator('input[name="skillArea"][value="Project management, operations, or administration"]').check();
  await page.locator('input[name="outreachPlatform"][value="LinkedIn"]').check();
  await page.locator('input[name="outreachPlatform"][value="Podcast, blog, or newsletter"]').check();
  await page.locator('#public-profile').fill('https://example.com/profile');
  await page.locator('#audience-size').selectOption({ label: '2,500–9,999' });
  await page.locator('#audience-description').fill('Food, agriculture, logistics, and nonprofit professionals.');
  await page.locator('#content-formats').fill('LinkedIn posts, interviews, articles, and newsletter features.');
  await page.locator('#outreach-ideas').fill('Interview farmers and logistics leaders about efficient food distribution.');
  await page.locator('#weekly-hours').selectOption({ label: '3–5 hours' });
  await page.locator('#start-time').selectOption({ label: 'Within 30 days' });
  await page.locator('#time-zone').fill('Mountain Time');
  await page.locator('#consent-contact').check();
  await page.locator('#acknowledge-status').check();
  await page.locator('#acknowledge-sensitive').check();
  await page.locator('#updates').check();

  await page.getByRole('button', { name: 'Submit my questionnaire' }).click();
  await page.locator('#summary.open').waitFor();

  const emailHref = await page.locator('#email-link').getAttribute('href');
  if (!emailHref?.startsWith('mailto:info@foodaidproject.org')) throw new Error('Fallback email target is incorrect.');
  if (!emailHref.includes('outreach-influencer')) throw new Error('Outreach routing tag is missing.');

  const summaryText = await page.locator('#summary-text').textContent();
  for (const required of ['Test Participant', 'Northern Colorado', 'LinkedIn', 'Podcast, blog, or newsletter', 'Remote only']) {
    if (!summaryText?.includes(required)) throw new Error(`Generated summary is missing: ${required}`);
  }

  await page.screenshot({ path: `${outputDir}/questionnaire-outreach-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/service-corps.html`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#primary-nav.open').waitFor();
  await page.screenshot({ path: `${outputDir}/questionnaire-mobile.png`, fullPage: true });

  await page.goto(`${baseUrl}/privacy.html`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Privacy notice' }).waitFor();
  await page.screenshot({ path: `${outputDir}/privacy-mobile.png`, fullPage: true });

  console.log('Browser verification: PASS');
} finally {
  await browser.close();
}
