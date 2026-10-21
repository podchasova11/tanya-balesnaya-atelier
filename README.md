# Таня Балесная — сайт ателье

Лендинг на чистых HTML, CSS и JavaScript. Заявки из формы уходят в Telegram через серверную функцию Vercel.

## Структура
- `index.html`, `styles.css`, `script.js` — главная страница
- `privacy.html`, `consent.html`, `cookies.html` — юридические страницы
- `api/request.js` — приём заявок и отправка в Telegram
- `assets/` — логотип и фотографии
- `robots.txt`, `sitemap.xml`, `vercel.json` — настройки для поиска и Vercel

## Настройки (Vercel → Settings → Environment Variables)
- `TELEGRAM_BOT_TOKEN` — токен бота от @BotFather
- `TELEGRAM_CHAT_ID` — ID чата (можно несколько через запятую)

Секреты в репозиторий не добавляйте.

## Запуск и публикация
Локально: `python3 -m http.server 8000`, затем http://localhost:8000.
Публикация: `npx vercel --prod`.
