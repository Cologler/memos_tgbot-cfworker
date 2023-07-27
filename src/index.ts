import { FileBase, Update, Message } from "node-telegram-bot-api";

export interface Env {
	// secret
    readonly TG_BOT_TOKEN: string;
    readonly TG_BOT_WEBHOOK_PATH: string;

    // envs
    readonly MEMO_SUFFIX?: string;
    readonly MEMO_PREFIX?: string;
}

function postJson(url: string, obj: object) {
    return fetch(url, {
        method: 'POST',
        body: JSON.stringify(obj),
        headers: {
            'content-type': 'application/json',
        }
    });
}

class TgBotClient {
    constructor(public botToken: string) {
    }

    get botBaseUrl() {
        return `https://api.telegram.org/bot${this.botToken}`;
    }

    getMethodUrl(method: string) {
        return this.botBaseUrl + '/' + method;
    }

    async unwrapResponse<T>(resp: Response): Promise<T> {
        if (!resp.ok) {
            throw new Error(resp.statusText);
        }

        const payload: {
            ok: boolean,
            result: any
        } = await resp.json();

        if (!payload.ok) {
            console.debug(payload);
            throw new Error(resp.statusText);
        }

        return payload.result;
    }

    async sendMessage(chatId: number, text: string) {
        console.debug(`sendMessage: ${chatId} ${text}`);

        await postJson(this.getMethodUrl('sendMessage'), {
            chat_id: chatId,
            text,
        });
    }

    async replyMessage(chatId: number, replyTo: number, text: string) {
        console.debug(`replyMessage: ${chatId} ${text}`);

        await postJson(this.getMethodUrl('sendMessage'), {
            chat_id: chatId,
            text,
            reply_to_message_id: replyTo
        });
    }

    async getFile(fileId: string) {
        const r = await postJson(this.getMethodUrl('getFile'), {
            file_id: fileId
        });

        return await this.unwrapResponse<{
            file_id: string,
            file_unique_id: string,
            file_size?: number,
            file_path?: string
        }>(r);
    }

    getFileContentUrl(filePath: string) {
        return `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
    }

    async getFileAsBlob(tgFile: FileBase, mimeType?: string) {
        const fileId = tgFile.file_id;
        const fileSize = tgFile.file_size;

        console.debug(`Get ${fileId} (${fileSize}) from telegram`);

        if (!fileSize || fileSize >= 20*1024*1024) {
            throw new KnownError('Bot API limit file max size: 20MB');
        }

        const file = await this.getFile(fileId);
        console.debug(file);
        if (!file.file_path) {
            throw new KnownError('Bot API limit file download');
        }

        const fileUrl = this.getFileContentUrl(file.file_path);
        console.debug(`File url is ${fileUrl}`);

        const r = await fetch(fileUrl);
        if (!r.ok) {
            throw new KnownError(`Tg error: ${r.statusText}`);
        }

        let blob = await r.blob();

        if (mimeType) {
            blob = new Blob([blob], {
                type: mimeType
            })
        }

        return blob;
    }
}

export class MemosClient {
    public readonly baseUrl: string;
    public readonly openId: string | null;

    constructor(openApi: string) {
        const url = new URL(openApi);
        this.openId = url.searchParams.get('openId');

        url.search = '';
        url.pathname = '';
        this.baseUrl = url.toString();
    }

    getUrl(path: string) {
        const url = new URL(path, this.baseUrl);
        if (this.openId) {
            url.searchParams.set('openId', this.openId);
        }
        return url;
    }

    getUrlV1(path: string) {
        return this.getUrl(`api/v1/${path}`);
    }

    async unwrapResponse<T>(resp: Response): Promise<T> {
        if (!resp.ok) {
            throw new Error(resp.statusText);
        }

        return await resp.json();
    }

    async addMemo(memo: {
        content: string,
        resourceIdList?: number[]
    }) {
        const url = this.getUrlV1('memo');

        const r = await postJson(url.toString(), memo);

        return await this.unwrapResponse<{
            id: number
        }>(r);
    }

    async addResource(resource: {
        externalLink: string,
        filename: string,
        type: string
    }) {
        const url = this.getUrlV1('resource');

        const r = await postJson(url.toString(), resource);

        return await this.unwrapResponse<{
            id: number;
        }>(r);
    }

    async addBlob(
        blob: Blob,
        filename: string
    ) {
        const url = this.getUrlV1('resource/blob');

        const formData  = new FormData();
        formData.append('file', blob, filename);

        const r = await fetch(url, {
            method: 'POST',
            body: formData
        });

        return await this.unwrapResponse<{
            id: number,
            filename: string
        }>(r);
    }

    getResourceUrl(resourceId: number | string, fileName: string) {
        return this.getUrl(`o/r/${resourceId}/${fileName}`).toString();
    }
}

async function findMemosOpenApi(env: Env, tgUserId: number): Promise<string | null> {
    const fromEnv: string | undefined = (env as any)[`MEMOS_OPENAPI_${tgUserId}`];
    if (fromEnv) {
        return fromEnv;
    }

    return null;
}

class KnownError extends Error {
}

export function convertToMarkdown<T extends {
    message?: Pick<Message, 'text' | 'entities' | 'caption'>
}>(update: T): string {
    const text = update.message?.text;
    if (text) {
        if (update.message?.entities) {
            const formats = update.message.entities
                .filter(x => x.length > 0) // can be 0 ?
                ;

            const points = formats.map(x => { return {
                isStart: true,
                index: x.offset,
                format: x
            }}).concat(formats.map(x => { return {
                isStart: false,
                index: x.offset + x.length,
                format: x
            }})).sort((a, b) => a.index - b.index);

            let formatedText = '';
            let includedText = 0;
            function includeTo(to: number) {
                if (to > includedText) {
                    formatedText += text!.substring(includedText, to);
                    includedText = to;
                }
            }
            for (const point of points) {
                includeTo(point.index);
                switch (point.format.type) {
                    case 'text_link':
                        if (point.isStart) {
                            formatedText += '[';
                        } else {
                            formatedText += `](${point.format.url!})`;
                        }
                        break;
                    case 'bold':
                        formatedText += '**';
                        break;
                    case 'italic':
                        formatedText += '*';
                        break;
                    case 'strikethrough':
                        formatedText += '~~';
                        break;
                    case 'code':
                        formatedText += '`';
                        break;
                    case 'pre':
                        if (point.isStart) {
                            const lang = point.format.language || '';
                            // memos does not allow language with space separator
                            formatedText += '```' + lang + '\n';
                        } else {
                            formatedText += '\n```';
                        }
                        break;
                }
            }
            includeTo(text.length);
            return formatedText;
        }
        return text;
    }

    return update.message?.caption || '';
}

async function getBlobFromTelegramUpdate(update: Update, tgBot: TgBotClient): Promise<null | { name: string, blob: Blob }> {
    const photos = update.message?.photo;
    const document = update.message?.document;
    const sticker = update.message?.sticker;

    if (photos) {
        const photo = photos[photos.length - 1]; // the last one is bigest
        const blob = await tgBot.getFileAsBlob(photo, 'image/*');
        return {
            name: `tg-photo-${photo.file_unique_id}.jpg`,
            blob
        };
    } else if (document) {
        const blob = await tgBot.getFileAsBlob(document, document.mime_type);
        return {
            name: document.file_name ?? `tg-doc-${document.file_unique_id}`,
            blob
        }
    } else if (sticker && !sticker.is_animated) {
        // see: https://core.telegram.org/stickers
        const mimeType = sticker.is_video ? 'video/*' : 'image/*';
        const ext = sticker.is_video ? '.webm' : '.webp';
        const blob = await tgBot.getFileAsBlob(sticker, mimeType);
        return {
            name: `tg-sticker-${sticker.file_unique_id}${ext}`,
            blob
        };
    }
    return null;
}

async function handleTelegramUpdate(env: Env, update: Update): Promise<void> {
	// for update content, check: https://core.telegram.org/bots/api#update

	const chatId = update.message?.chat.id; // for reply to
    const messageId = update.message?.message_id;
    const userId = update.message?.from?.id;

	const text = update.message?.text;
    const photos = update.message?.photo;
    const document = update.message?.document;
    const sticker = update.message?.sticker;

    const tgBot = new TgBotClient(env.TG_BOT_TOKEN);

    if (chatId && messageId) {
        if (text === '/start') {
            const replyContent = 'Hello World!'
            await tgBot.sendMessage(chatId, replyContent);
        }
        else if (userId !== undefined) {
            const openApi = await findMemosOpenApi(env, userId);
            if (openApi === null) {
                await tgBot.sendMessage(chatId, 'You are not a user.');
            } else {
                const memos = new MemosClient(openApi);
                try {
                    const markdown = convertToMarkdown(update);
                    const file = await getBlobFromTelegramUpdate(update, tgBot);

                    if (markdown || file) {
                        const contentRows = [];
                        contentRows.push(env.MEMO_PREFIX);
                        contentRows.push(markdown);
                        contentRows.push(env.MEMO_SUFFIX);
                        const content = contentRows.filter(x => x).join('\n');

                        const resourceIdList = file ? [(await memos.addBlob(file.blob, file.name)).id] : undefined;
                        console.debug('resourceIdList:', resourceIdList);

                        const memo = await memos.addMemo({
                            content: content,
                            resourceIdList
                        });
                        console.debug('memo:', memo);

                        const replyContent = `Create memo: ${memo!.id}`;
                        await tgBot.replyMessage(chatId, messageId, replyContent);
                    }

                } catch (error) {
                    if (error instanceof KnownError) {
                        await tgBot.sendMessage(chatId, error.message);
                    } else {
                        console.error(error);
                        await tgBot.sendMessage(chatId, 'Unknown error');
                    }
                }
            }
        }
    }
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {

		const url = new URL(request.url);

        if (request.method === 'POST' && (!env.TG_BOT_WEBHOOK_PATH || url.pathname === `/${env.TG_BOT_WEBHOOK_PATH}`)) {
			// request is sent by telegram

            if (request.headers.get('content-type') !== 'application/json') {
                console.error(`invalid content-type: ${request.headers.get('content-type')}`);
            }
            else {
                try {
                    await handleTelegramUpdate(env, await request.json());
                } catch { }
                // telegram does not care this.
                // but without a response, telegram will send again and again.
                return new Response();
            }
        }

		return new Response("Hello World!");
	},
};
