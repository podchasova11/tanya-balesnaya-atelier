const { test, expect } = require('@playwright/test');
const { blockExternal } = require('./helpers');

const EMAIL = 'tanyabalesnaya@yandex.ru';
const pages = [
  { path: '/privacy', title: 'Политика обработки персональных данных', operator: 'ИП Балесная Т.В.' },
  { path: '/consent', title: 'Согласие на обработку персональных данных', operator: 'ИП Балесной Т.В.' },
  { path: '/cookies', title: 'Политика в отношении обработки файлов Cookie', operator: null },
];
// Данные прежнего владельца текстов не должны остаться на странице.
const FORBIDDEN = ['t-lab', 'Ненашев', 'ОГРНИП', 'ИНН', 'prod@', 'СЕНДПУЛЬС', 'BITRIX', 'reCAPTCHA', 'Пэйкипер'];

test.beforeEach(async ({ page }) => { await blockExternal(page); });

for (const p of pages) {
  test(`${p.path}: заголовок, почта и отсутствие чужих данных`, async ({ page }) => {
    await page.goto(p.path);
    await expect(page.locator('h1')).toContainText(p.title);
    const text = await page.locator('main').innerText();
    if (p.operator) expect(text).toContain(p.operator);
    expect(text).toContain(EMAIL);
    for (const bad of FORBIDDEN) expect(text, `лишнее: ${bad}`).not.toContain(bad);
  });

  test(`${p.path}: ссылки в подвале и отсутствие переполнения`, async ({ page, viewport }) => {
    await page.goto(p.path);
    const hrefs = await page.locator('.legal__links a').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
    expect(hrefs).toEqual(['/privacy', '/consent', '/cookies']);
    await expect(page.locator('.legal__links a[aria-current=page]')).toHaveAttribute('href', p.path);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(viewport.width);
  });
}

test('главная: подвал и чекбокс ведут на документы', async ({ page }) => {
  await page.goto('/');
  const footer = await page.locator('.legal__links a').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
  expect(footer).toEqual(['/privacy', '/consent', '/cookies']);
  const consent = await page.locator('.form__consent a').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
  expect(consent).toEqual(['/consent', '/privacy']);
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
});
