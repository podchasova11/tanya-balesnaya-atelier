const { test, expect } = require('@playwright/test');
const { blockExternal } = require('./helpers');

test.beforeEach(async ({ page }) => { await blockExternal(page); });

test('главная: нет горизонтальной прокрутки и ошибок JS', async ({ page, viewport }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(viewport.width);
  expect(errors).toEqual([]);
});

test('главная: одна h1 и корректные title/description', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page).toHaveTitle(/Таня Балесная/);
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /ателье/i);
});

test('главная: все картинки загружаются и имеют alt', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 500));
  });
  const imgs = await page.evaluate(() =>
    [...document.images].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, alt: i.alt })));
  expect(imgs.length).toBeGreaterThan(0);
  expect(imgs.filter((i) => !i.ok)).toEqual([]);
  expect(imgs.filter((i) => !i.alt)).toEqual([]);
});

test('главная: все якоря ведут к существующим блокам', async ({ page }) => {
  await page.goto('/');
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h.length > 1 && !document.querySelector(h)));
  expect(broken).toEqual([]);
});

test('навигация: переход по меню', async ({ page, viewport }) => {
  await page.goto('/');
  if (viewport.width <= 860) {
    await page.locator('.nav__burger').click();
    await expect(page.locator('.nav__list')).toBeVisible();
    await page.locator('.nav__list a[href="#services"]').click();
    await expect(page.locator('.nav__list')).toBeHidden();
  } else {
    await expect(page.locator('.nav__list')).toBeVisible();
    await page.locator('.nav__list a[href="#process"]').click();
    await expect.poll(() => page.evaluate(() => document.querySelector('#process').getBoundingClientRect().top))
      .toBeLessThan(140);
  }
});

test('карта: есть виджет Яндекса и ссылки на карты', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('iframe.map__frame')).toHaveAttribute('src', /yandex\.ru\/map-widget/);
  await expect(page.locator('a[href*="yandex.ru/maps"]').first()).toBeVisible();
});

test('поисковые файлы: robots.txt и sitemap.xml доступны', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain('Sitemap:');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain('<urlset');
});
