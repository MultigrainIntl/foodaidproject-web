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

  await page.getByRole('link', { name: 'Complete the interest questionnaire' }).click();
  await page.waitForURL(/service-corps\.html/);
  await page.getByRole('heading', { name: 'The hours are yours.' }).waitFor();
  await page.getByRole('heading', { name: 'Help us understand the right fit' }).waitFor();

  const courtFields = page.locator('#court-fields');
  if (await courtFields.getAttribute('aria-hidden') !== 'true') {
    throw new Error('Court fields should be hidden initially.');
  }

  await page.locator('#court-service').check();
  if (await courtFields.getAttribute('aria-hidden') !== 'false') {
    throw new Error('Court fields should open when community service is selected.');
  }

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
  await page.locator('#skills-summary').fill('Project planning, logistics, relationship development, and research.');
  await page.locator('#love-to-do').fill('Connect people, solve practical problems, and organize information.');
  await page.locator('input[name="skillArea"][value="Project management, operations, or administration"]').check();
  await page.locator('input[name="skillArea"][value="Sales, business development, or customer relationships"]').check();
  await page.locator('#service-format').selectOption({ label: 'Either remote or in person' });
  await page.locator('#weekly-hours').selectOption({ label: '3–5 hours' });
  await page.locator('#start-time').selectOption({ label: 'Within 30 days' });
  await page.locator('#consent-contact').check();
  await page.locator('#acknowledge-status').check();
  await page.locator('#acknowledge-sensitive').check();
  await page.locator('#updates').check();

  await page.getByRole('button', { name: 'Prepare my questionnaire' }).click();
  await page.locator('#summary.open').waitFor();

  const emailHref = await page.locator('#email-link').getAttribute('href');
  if (!emailHref || !emailHref.startsWith('mailto:info@foodaidproject.org')) {
    throw new Error('Generated email does not target info@foodaidproject.org.');
  }
  if (!emailHref.includes('Service%20Corps%20Interest')) {
    throw new Error('Generated email is missing the routing subject.');
  }

  const summaryText = await page.locator('#summary-text').textContent();
  if (!summaryText?.includes('Test Participant') || !summaryText.includes('Northern Colorado')) {
    throw new Error('Generated summary is missing submitted values.');
  }

  await page.screenshot({ path: `${outputDir}/questionnaire-completed-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/service-corps.html`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#primary-nav.open').waitFor();
  await page.screenshot({ path: `${outputDir}/questionnaire-mobile.png`, fullPage: true });

  await page.goto(`${baseUrl}/privacy.html`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Privacy notice' }).waitFor();
  await page.getByText('The current questionnaire runs entirely in your browser.').waitFor();
  await page.screenshot({ path: `${outputDir}/privacy-mobile.png`, fullPage: true });

  console.log('Browser verification: PASS');
} finally {
  await browser.close();
}
