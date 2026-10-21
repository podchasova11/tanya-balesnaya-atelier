// Vercel Serverless Function: приём заявки и отправка в Telegram.
// Переменные окружения (Vercel → Project → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN — токен бота от @BotFather
//   TELEGRAM_CHAT_ID   — id чата/пользователя (можно несколько через запятую)

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // IP -> [timestamps]; живёт, пока тёплый инстанс (грубая защита)

function tooMany(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 500) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return arr.length > MAX_PER_WINDOW;
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  // запросы только с нашего сайта
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (e) { /* ignore */ }
    if (host !== req.headers.host) return send(res, 403, { ok: false, error: 'forbidden' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (tooMany(ip)) return send(res, 429, { ok: false, error: 'too_many_requests' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') return send(res, 400, { ok: false, error: 'bad_request' });

  // ловушка для ботов — отвечаем «успехом», но ничего не отправляем
  if (body.website) return send(res, 200, { ok: true });

  const name = clean(body.name, 80);
  const phone = clean(body.phone, 30);
  const message = clean(body.message, 1000);
  const digits = phone.replace(/\D/g, '');

  if (name.length < 2) return send(res, 400, { ok: false, error: 'invalid_name' });
  if (digits.length < 10 || digits.length > 15) return send(res, 400, { ok: false, error: 'invalid_phone' });
  if (body.consent !== true) return send(res, 400, { ok: false, error: 'consent_required' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chats = String(process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!token || !chats.length) return send(res, 503, { ok: false, error: 'not_configured' });

  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const text = [
    'Новая заявка с сайта',
    '',
    'Имя: ' + name,
    'Телефон: ' + phone,
    'Что шить: ' + (message || '—'),
    '',
    when + ' (МСК)'
  ].join('\n');

  try {
    const results = await Promise.all(chats.map(async (chat_id) => {
      const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, disable_web_page_preview: true })
      });
      return r.ok;
    }));
    if (!results.some(Boolean)) return send(res, 502, { ok: false, error: 'delivery_failed' });
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 502, { ok: false, error: 'delivery_failed' });
  }
};
