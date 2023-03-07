import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

import { MemosClient } from '.';

describe("Worker", () => {
	let worker: UnstableDevWorker;

	beforeAll(async () => {
		worker = await unstable_dev("src/index.ts", {
			experimental: { disableExperimentalWarning: true },
		});
	});

	afterAll(async () => {
		await worker.stop();
	});

	it("should return Hello World", async () => {
		const resp = await worker.fetch();
		if (resp) {
			const text = await resp.text();
			expect(text).toMatchInlineSnapshot(`"Hello World!"`);
		}
	});
});

describe('MemosClient', () => {
	const date = new Date().toString();
	const client = new MemosClient('http://127.0.0.1:5230/api/memo?openId=a5b14631-d824-4ee8-aa3a-e573fa59a4f5');

	it("should be able create memos", async () => {
		const resp = await client.addMemo({
			content: `now is ${date}`
		});
		expect(resp.id).toBeGreaterThan(0);
	});
});
