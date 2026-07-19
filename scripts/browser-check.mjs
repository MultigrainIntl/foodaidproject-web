import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseUrl = process.env.SITE_URL || 'http://127.0.0.1:8000';
const artifactDir = process.env.ARTIFACT_DIR || 'artifacts';
const screenshotDir = process.env.SCREENSHOT_DIR || `${artifactDir}/site-proof`;
const foodBankBuilderPattern = '**/AKfycbzXzcJrEfcG26FIltfrqHQFsRPD2Qu_War3vGHdFBpbqKN6CEWewmF8_6Qab9dbmTLN/**';
const serviceCorpsEndpointPattern = '**/AKfycbzVIx_2Qc0w9f4ch7b3uo-n8Krs86r4_DAAT8CPhwkfCGpsA3WryOApucfUp9n9eqou/**';

const routes = [
  { slug: 'homepage', path: '/index.html', heading: 'Make every food-security decision count.', essential: 'Skills for Food Security Service Corps' },
  { slug: 'food-bank-supply', path: '/food-banks.html', heading: 'Build your own mixed truckload of bulk dry goods', essential: 'Mixed Truckload Builder' },
  { slug: 'zel-zanj', path: '/zel-zanj.html', heading: 'Zèl Zanj', essential: 'Built for impact per dollar' },
  { slug: 'service-corps', path: '/service-corps.html', heading: 'The hours are yours.', essential: 'Remote-only operating model:' },
  { slug: 'trust-transparency', path: '/trust.html', heading: 'Real, registered, and accountable.', essential: 'IRS determination' },
  { slug: 'privacy', path: '/privacy.html', heading: 'Privacy notice', essential: 'request correction or deletion' },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

const results = [];
const failures = [];
const testedInternalUrls = new Set();
const blockedIntakeRequests = [];

await fs.mkdir(screenshotDir, { recursive: true });

function record(scope, status, detail = '') {
  results.push({ scope, status, detail });
  if (status === 'FAIL') failures.push(`${scope}: ${detail}`);
}

async function check(scope, action) {
  try {
    await action();
    record(scope, 'PASS');
  } catch (error) {
    record(scope, 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });

    // Never allow the public Service Corps endpoint to receive a QA submission.
    await context.route('**/service-corps-config.js', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: "window.FAP_SERVICE_CORPS_CONFIG=Object.freeze({endpoint:'',responseOrigins:[]});",
    }));
    await context.route(foodBankBuilderPattern, route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>QA isolation</title><p>Live truckload builder isolated during automated QA.</p>',
    }));
    await context.route(serviceCorpsEndpointPattern, async route => {
      if (route.request().method() === 'POST') {
        blockedIntakeRequests.push(route.request().url());
        await route.abort('blockedbyclient');
      } else await route.fallback();
    });

    for (const route of routes) {
      const page = await context.newPage();
      const browserErrors = [];
      page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
      page.on('console', message => {
        if (message.type() === 'error') browserErrors.push(`console.error: ${message.text()}`);
      });
      page.on('response', response => {
        if (response.url().startsWith(baseUrl) && response.status() >= 400) {
          browserErrors.push(`HTTP ${response.status()}: ${response.url()}`);
        }
      });
      page.on('requestfailed', request => {
        if (request.url().startsWith(baseUrl)) {
          browserErrors.push(`request failed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`);
        }
      });

      const scope = `${route.slug}/${viewport.name}`;
      await check(`${scope} page, heading, and essential content`, async () => {
        const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' });
        assert(response?.ok(), `Navigation returned HTTP ${response?.status() ?? 'unknown'}`);
        await page.getByRole('heading', { level: 1, name: route.heading, exact: true }).waitFor();
        await page.getByText(route.essential, { exact: false }).first().waitFor();
      });

      await check(`${scope} navigation`, async () => {
        const nav = page.locator('nav').first();
        assert(await nav.count(), 'Primary navigation is missing');
        if (viewport.name === 'desktop') {
          assert(await nav.isVisible(), 'Desktop navigation is not visible');
          assert(await nav.locator('a').count() >= 3, 'Desktop navigation has fewer than three links');
        } else {
          const toggle = page.locator('.nav-toggle, .atlas-menu').first();
          assert(await toggle.isVisible(), 'Mobile menu button is not visible');
          await toggle.click();
          assert(await nav.isVisible(), 'Mobile navigation did not open');
          assert(await toggle.getAttribute('aria-expanded') === 'true', 'Mobile menu did not expose expanded state');
        }
      });

      await check(`${scope} images`, async () => {
        const images = page.locator('img');
        assert(await images.count() > 0, 'No logo or content image found');
        for (const image of await images.all()) {
          if (!await image.isVisible()) continue;
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(node => {
            if (node.complete) return;
            return new Promise(resolve => {
              node.addEventListener('load', resolve, { once: true });
              node.addEventListener('error', resolve, { once: true });
            });
          });
        }
        const broken = await images.evaluateAll(nodes => nodes
          .filter(image => image.getClientRects().length > 0)
          .filter(image => !image.complete || image.naturalWidth === 0)
          .map(image => image.getAttribute('src') || '(missing src)'));
        assert(broken.length === 0, `Broken images: ${broken.join(', ')}`);
      });

      await check(`${scope} horizontal overflow`, async () => {
        const dimensions = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        assert(dimensions.scrollWidth <= dimensions.clientWidth + 1,
          `Page is ${dimensions.scrollWidth - dimensions.clientWidth}px wider than the viewport`);
      });

      await check(`${scope} meaningful browser errors`, async () => {
        await page.waitForTimeout(150);
        assert(browserErrors.length === 0, browserErrors.join(' | '));
      });

      if (route.slug === 'homepage') {
        await check(`${scope} global agricultural precipitation`, async () => {
          const radar = page.frameLocator('iframe[title="Live GISit global precipitation across agricultural regions"]');
          const location = radar.locator('#radar-location');
          await location.waitFor();
          await radar.locator('#radar-status', { hasText: 'recent' }).waitFor({ timeout: 10000 });
          const initialRegion = (await location.textContent())?.trim();
          assert(initialRegion && initialRegion !== 'Loading region…', 'Agricultural region did not initialize');
          assert(!initialRegion.includes('Melfort'), 'Private location remains in the radar rotation');
          await radar.locator('#region-next').click();
          await page.waitForTimeout(500);
          const nextRegion = (await location.textContent())?.trim();
          assert(nextRegion && nextRegion !== initialRegion, 'Next-region control did not change the map');
          assert((await radar.locator('#region-count').textContent())?.includes('paused'), 'Manual region selection did not pause automatic rotation');
        });
      }

      await check(`${scope} screenshot`, async () => {
        await page.screenshot({ path: `${screenshotDir}/${route.slug}-${viewport.name}.png`, fullPage: true });
      });

      if (viewport.name === 'desktop') {
        await check(`${route.slug} primary internal links`, async () => {
          const hrefs = await page.locator('a[href]').evaluateAll(links => links
            .map(link => link.getAttribute('href'))
            .filter(href => href && href.startsWith('/') && !href.match(/\.(pdf|png|svg|webp|ico)(#|$)/i)));
          for (const href of hrefs) {
            const url = new URL(href, baseUrl);
            url.hash = '';
            const key = url.toString();
            if (testedInternalUrls.has(key)) continue;
            testedInternalUrls.add(key);
            const response = await context.request.get(key);
            assert(response.ok(), `${href} returned HTTP ${response.status()}`);
          }
        });
      }

      await page.close();
    }

    await context.close();
  }

  await check('Service Corps conditional fields and safe fallback', async () => {
    const context = await browser.newContext({ viewport: { width: viewports[0].width, height: viewports[0].height } });
    await context.route('**/service-corps-config.js', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: "window.FAP_SERVICE_CORPS_CONFIG=Object.freeze({endpoint:'',responseOrigins:[]});",
    }));
    await context.route(foodBankBuilderPattern, route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>QA isolation</title><p>Live truckload builder isolated during automated QA.</p>',
    }));
    await context.route(serviceCorpsEndpointPattern, async route => {
      if (route.request().method() === 'POST') {
        blockedIntakeRequests.push(route.request().url());
        await route.abort('blockedbyclient');
      } else await route.fallback();
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/service-corps.html`, { waitUntil: 'networkidle' });

    const courtFields = page.locator('#court-fields');
    assert(await courtFields.getAttribute('aria-hidden') === 'true', 'Court fields are not hidden initially');
    await page.locator('#court-service').check();
    assert(await courtFields.getAttribute('aria-hidden') === 'false', 'Court fields did not open');

    await page.locator('#outreach-service').check();
    await page.locator('#full-name').fill('Automated QA Participant');
    await page.locator('#email').fill('qa@example.invalid');
    await page.locator('#contact-method').selectOption({ label: 'Email' });
    await page.locator('#city').fill('Fort Collins');
    await page.locator('#region').fill('Colorado');
    await page.locator('#country').fill('United States');
    await page.locator('#adult-status').selectOption({ label: 'Yes' });
    await page.locator('#hours-needed').fill('40');
    await page.locator('#jurisdiction').fill('Automated QA jurisdiction');
    await page.locator('#approval-status').selectOption({ label: 'I have not asked the supervising authority yet' });
    await page.locator('#skills-summary').fill('Automated browser testing and quality assurance.');
    await page.locator('#love-to-do').fill('Find regressions before visitors encounter them.');
    await page.locator('input[name="skillArea"][value="Outreach, social media, influencer engagement, or digital content"]').check();
    await page.locator('input[name="outreachPlatform"][value="LinkedIn"]').check();
    await page.locator('#weekly-hours').selectOption({ label: '3–5 hours' });
    await page.locator('#start-time').selectOption({ label: 'Within 30 days' });
    await page.locator('#consent-contact').check();
    await page.locator('#acknowledge-status').check();
    await page.locator('#acknowledge-sensitive').check();

    await page.getByRole('button', { name: 'Submit my questionnaire' }).click();
    await page.locator('#summary.open').waitFor();
    const emailHref = await page.locator('#email-link').getAttribute('href');
    assert(emailHref?.startsWith('mailto:info@foodaidproject.org'), 'Fallback email target is incorrect');
    assert(emailHref.includes('outreach-influencer'), 'Outreach routing tag is missing');
    const summary = await page.locator('#summary-text').textContent();
    for (const value of ['Automated QA Participant', 'Automated QA jurisdiction', 'LinkedIn', 'Remote only']) {
      assert(summary?.includes(value), `Fallback summary is missing: ${value}`);
    }
    assert(blockedIntakeRequests.length === 0,
      `The test attempted ${blockedIntakeRequests.length} real intake request(s)`);
    await page.screenshot({ path: `${screenshotDir}/service-corps-safe-fallback-desktop.png`, fullPage: true });
    await context.close();
  });
} finally {
  await browser.close();
  const diagnostics = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    routes: routes.map(route => route.path),
    viewports,
    blockedIntakeRequests,
    tests: results,
    passed: results.filter(result => result.status === 'PASS').length,
    failed: failures.length,
    failures,
  };
  await fs.writeFile(`${artifactDir}/qa-results.json`, `${JSON.stringify(diagnostics, null, 2)}\n`);
}

if (failures.length) {
  console.error(`Browser verification: FAIL (${failures.length} failure(s))`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Browser verification: PASS (${results.length} checks)`);
}
