# send-to-memos-tgbot

A telegram bot for saving messages to self-hosted [memos](https://github.com/usememos/memos), and hosted on cloudflare worker.

## Features

Support message types:

- Text
- Photo
- File
- Image or video sticker

*Telegram limit: bot can download files of up to 20MB in size.*

## Deploy

1. Clone repo;
1. Run `npm install && npm run deploy` to deploy;
1. Create your bot via https://t.me/BotFather;
1. Find your telegram id via https://t.me/userinfobot;
1. Go to the cloudflare worker dashboard, add **encrypted** variables:
    - `TG_BOT_TOKEN`: your bot token;
    - `TG_BOT_WEBHOOK_PATH`: optional path, can use as secret;
    - `MEMOS_OPENAPI_$(your telegram id)`: your memos openapi url;
1. use https://telegram-set-webhook.tools.dor.ky to bind your worker and bot;

Finally, you can send text or photo to memos.
