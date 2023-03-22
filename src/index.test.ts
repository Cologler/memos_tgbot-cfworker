import { describe, expect, it } from "vitest";

import { convertTelegramUpdateContentToMarkdown } from '.';

describe('Content Convert', () => {
	it('can convert plaintext', async () => {
		const markdown = convertTelegramUpdateContentToMarkdown({
			"message": {
				"message_id": 0,
				"from": {
					"id": 0,
				},
				"chat": {
					"id": 0,
				},
				"text": "sss"
			}
		});
		expect(markdown).toStrictEqual('sss');
	});

	it('can convert text formated with url', async () => {
		const markdown = convertTelegramUpdateContentToMarkdown({
			"message": {
				"message_id": 0,
				"from": {
					"id": 0,
				},
				"chat": {
					"id": 0,
				},
				"text": "fsafafasfdsgdsgfdshfdhdfghfghgfhgfhgfhgfhgf",
				"entities": [
					{
						"offset": 5,
						"length": 8,
						"type": "text_link",
						"url": "https://001.example.com/"
					},
					{
						"offset": 22,
						"length": 7,
						"type": "text_link",
						"url": "https://002.example.com/"
					},
					{
						"offset": 38,
						"length": 3,
						"type": "text_link",
						"url": "https://003.example.com/"
					}
				]
			}
		});
		expect(markdown).toStrictEqual(
			'fsafa' +
			'[fasfdsgd](https://001.example.com/)' +
			'sgfdshfdh' +
			'[dfghfgh](https://002.example.com/)' +
			'gfhgfhgfh' +
			'[gfh](https://003.example.com/)' +
			'gf');
	});

	it('can convert text formated with url', async () => {
		const markdown = convertTelegramUpdateContentToMarkdown({
			"message": {
				"message_id": 0,
				"from": {
					"id": 0,
				},
				"chat": {
					"id": 0,
				},
				"text": "dsgsdgsgsd",
				"entities": [
					{
						"offset": 2,
						"length": 3,
						"type": "italic"
					}
				]
			}
		});
		expect(markdown).toStrictEqual('ds*gsd*gsgsd');
	});
});
