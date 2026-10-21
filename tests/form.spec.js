const { test, expect } = require('@playwright/test');
const { blockExternal, fillForm } = require('./helpers');

const API = '**/api/request';
const submit = (page) => page.locator('#requestForm button[type=submit]');
const status = (page) => page.locator('#requestForm .form__status');

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
  await page.goto('/#request');
});

test('пустая форма: показывает три ошибки и ничего не отправляет', async ({ page }) => {
  let sent = 0;
  await page.route(API, (r) => { sent++; r.fulfill({ status: 200, body: '{"ok":true}' }); });
  await submit(page).click();
  await expect(page.locator('#err-name')).not.toBeEmpty();
  await expect(page.locator('#err-phone')).not.toBeEmpty();
  await expect(page.locator('#err-consent')).not.toBeEmpty();
  expect(sent).toBe(0);
});

test('маска телефона форматирует номер', async ({ page }) => {
  const phone = page.locator('#requestForm [name=phone]');
  await phone.pressSequentially('9260001122');
  await expect(phone).toHaveValue('+7 (926) 000-11-22');
});

test('телефон с 8 в начале превращается в +7', async ({ page }) => {
  const phone = page.locator('#requestForm [name=phone]');
  await phone.pressSequentially('89260001122');
  await expect(phone).toHaveValue('+7 (926) 000-11-22');
});

test('неполный телефон: ошибка', async ({ page }) => {
  await fillForm(page, { phone: '926' });
  await submit(page).click();
  await expect(page.locator('#err-phone')).not.toBeEmpty();
});

test('без согласия заявка не уходит', async ({ page }) => {
  let sent = 0;
  await page.route(API, (r) => { sent++; r.fulfill({ status: 200, body: '{"ok":true}' }); });
  await fillForm(page, { consent: false });
  await submit(page).click();
  await expect(page.locator('#err-consent')).not.toBeEmpty();
  expect(sent).toBe(0);
});

test('успешная отправка: правильные данные и сообщение об успехе', async ({ page }) => {
  let body;
  await page.route(API, (r) => { body = r.request().postDataJSON(); r.fulfill({ status: 200, body: '{"ok":true}' }); });
  await fillForm(page, { message: 'Свадебное платье' });
  await submit(page).click();
  await expect(status(page)).toContainText('Спасибо');
  expect(body).toEqual({ name: 'Анна', phone: '+79260001122', message: 'Свадебное платье', consent: true });
  await expect(page.locator('#requestForm [name=name]')).toHaveValue('');
});

test('сбой сервера: сообщение с телефоном для связи, поля сохранены', async ({ page }) => {
  await page.route(API, (r) => r.fulfill({ status: 502, body: '{"ok":false}' }));
  await fillForm(page);
  await submit(page).click();
  await expect(status(page)).toContainText('Позвоните');
  await expect(page.locator('#requestForm [name=name]')).toHaveValue('Анна');
});

test('слишком много заявок (429): отдельное сообщение', async ({ page }) => {
  await page.route(API, (r) => r.fulfill({ status: 429, body: '{"ok":false}' }));
  await fillForm(page);
  await submit(page).click();
  await expect(status(page)).toContainText('Слишком много');
});

test('обрыв сети: сообщение об ошибке', async ({ page }) => {
  await page.route(API, (r) => r.abort());
  await fillForm(page);
  await submit(page).click();
  await expect(status(page)).toContainText('Не удалось');
});

test('ловушка для ботов: запрос не отправляется', async ({ page }) => {
  let sent = 0;
  await page.route(API, (r) => { sent++; r.fulfill({ status: 200, body: '{"ok":true}' }); });
  await fillForm(page);
  await page.locator('#requestForm [name=website]').evaluate((el) => { el.value = 'http://spam'; });
  await submit(page).click();
  await expect(status(page)).toContainText('Спасибо');
  expect(sent).toBe(0);
});

test('во время отправки кнопка заблокирована и второй запрос не уходит', async ({ page }) => {
  let sent = 0;
  let release;
  const gate = new Promise((res) => { release = res; });
  await page.route(API, async (r) => { sent++; await gate; r.fulfill({ status: 200, body: '{"ok":true}' }); });
  await fillForm(page);
  await submit(page).click();
  await expect(submit(page)).toBeDisabled();
  await page.locator('#requestForm').evaluate((f) => f.requestSubmit());
  release();
  await expect(status(page)).toContainText('Спасибо');
  expect(sent).toBe(1);
});
