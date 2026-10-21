// Тесты серверной функции без сети: Telegram подменён.
// Запуск: npm run test:api
const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/request.js');

function call({ method = 'POST', headers = {}, body, ip = '1.1.1.1' } = {}) {
  return new Promise((resolve) => {
    const req = { method, headers: { host: 'site.test', 'x-forwarded-for': ip, ...headers }, body, socket: { remoteAddress: ip } };
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(d) { resolve({ code: this.statusCode, json: d ? JSON.parse(d) : null, headers: this.headers }); },
    };
    handler(req, res);
  });
}

const good = { name: 'Анна', phone: '+79260001122', message: 'Платье <b>на свадьбу</b>', consent: true };
let calls = [];
let tgOk = true;
global.fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: tgOk }; };
let n = 0;
const ip = () => '10.0.0.' + (++n);

test('GET даёт 405', async () => { assert.equal((await call({ method: 'GET', ip: ip() })).code, 405); });
test('чужой Origin даёт 403', async () => {
  assert.equal((await call({ headers: { origin: 'https://evil.example' }, body: good, ip: ip() })).code, 403);
});

test('без настроек Telegram: 503 и ничего не отправлено', async () => {
  delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID;
  calls = [];
  const r = await call({ body: good, ip: ip() });
  assert.equal(r.code, 503);
  assert.equal(r.json.error, 'not_configured');
  assert.equal(calls.length, 0);
});

test('с настройками', async (t) => {
  process.env.TELEGRAM_BOT_TOKEN = '123:ABC';
  process.env.TELEGRAM_CHAT_ID = '111, 222';

  await t.test('верная заявка уходит в оба чата обычным текстом', async () => {
    calls = [];
    const r = await call({ body: good, ip: ip() });
    assert.equal(r.code, 200);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((c) => c.body.chat_id), ['111', '222']);
    assert.ok(calls[0].url.startsWith('https://api.telegram.org/bot123:ABC/sendMessage'));
    assert.ok(calls[0].body.text.includes('<b>на свадьбу</b>'));
    assert.equal(calls[0].body.parse_mode, undefined);
  });
  await t.test('тело в виде JSON-строки разбирается', async () => {
    assert.equal((await call({ body: JSON.stringify(good), ip: ip() })).code, 200);
  });
  await t.test('пустое сообщение заменяется прочерком', async () => {
    calls = [];
    await call({ body: { ...good, message: '' }, ip: ip() });
    assert.ok(calls[0].body.text.includes('Что шить: —'));
  });
  await t.test('длинные поля обрезаются', async () => {
    calls = [];
    await call({ body: { ...good, name: 'А'.repeat(500), message: 'Б'.repeat(5000) }, ip: ip() });
    assert.ok(calls[0].body.text.length < 1300);
  });
  await t.test('короткое имя даёт 400', async () => {
    const r = await call({ body: { ...good, name: 'А' }, ip: ip() });
    assert.deepEqual([r.code, r.json.error], [400, 'invalid_name']);
  });
  await t.test('неверный телефон даёт 400', async () => {
    const r = await call({ body: { ...good, phone: '123' }, ip: ip() });
    assert.deepEqual([r.code, r.json.error], [400, 'invalid_phone']);
  });
  await t.test('без согласия даёт 400', async () => {
    const r = await call({ body: { ...good, consent: false }, ip: ip() });
    assert.deepEqual([r.code, r.json.error], [400, 'consent_required']);
  });
  await t.test('мусор в теле даёт 400', async () => {
    assert.equal((await call({ body: 'not json{', ip: ip() })).code, 400);
  });
  await t.test('ловушка для ботов: 200, но ничего не отправлено', async () => {
    calls = [];
    const r = await call({ body: { ...good, website: 'http://spam' }, ip: ip() });
    assert.equal(r.code, 200);
    assert.equal(calls.length, 0);
  });
  await t.test('Telegram отказал: 502', async () => {
    tgOk = false;
    const r = await call({ body: good, ip: ip() });
    tgOk = true;
    assert.equal(r.code, 502);
  });
  await t.test('ошибка сети: 502', async () => {
    const old = global.fetch;
    global.fetch = async () => { throw new Error('net'); };
    const r = await call({ body: good, ip: ip() });
    global.fetch = old;
    assert.equal(r.code, 502);
  });
  await t.test('шестая заявка с одного адреса за 10 минут: 429', async () => {
    let last;
    for (let i = 0; i < 6; i++) last = await call({ body: good, ip: '9.9.9.9' });
    assert.equal(last.code, 429);
  });
  await t.test('ответы не кэшируются', async () => {
    assert.equal((await call({ body: good, ip: ip() })).headers['Cache-Control'], 'no-store');
  });
});
