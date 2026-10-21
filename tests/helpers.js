// Внешние сервисы (шрифты, карта) в тестах отключаем: проверяем только наш код.
async function blockExternal(page) {
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => route.abort());
}

const good = { name: 'Анна', phone: '9260001122' };

async function fillForm(page, { name = 'Анна', phone = '9260001122', message = '', consent = true } = {}) {
  await page.locator('#requestForm [name=name]').fill(name);
  await page.locator('#requestForm [name=phone]').pressSequentially(phone);
  if (message) await page.locator('#requestForm [name=message]').fill(message);
  if (consent) await page.locator('#requestForm [name=consent]').check();
}

module.exports = { blockExternal, good, fillForm };
