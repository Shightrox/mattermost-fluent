// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-await-in-loop */
// Sequential disk access bounds resource use during large imports.

import {createHash} from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import {isSupportedGif} from 'common/personalGifs';

import {GIF_FILE_LIMIT, GIF_ITEM_LIMIT, GIF_LIBRARY_LIMIT} from 'types/personalGifs';
import type {GifRequest, GifResponse, PersonalGif} from 'types/personalGifs';

// Serialized writes prevent parallel server windows from exceeding the quota.
// Opaque content hashes are the only filenames accepted from renderers.
export class PersonalGifStore {
    private queue: Promise<unknown> = Promise.resolve();
    private items?: PersonalGif[];
    private directory: () => string;

    constructor(directory: () => string) {
        this.directory = directory;
    }

    request(request: GifRequest): Promise<GifResponse> {
        const result = this.queue.then(() => this.perform(request)).catch(() => ({error: 'storage'}));
        this.queue = result;
        return result;
    }

    private async list(): Promise<PersonalGif[]> {
        if (this.items) {
            return this.items;
        }
        const directory = this.directory();
        await fs.mkdir(directory, {recursive: true});
        const items: PersonalGif[] = [];
        for (const file of await fs.readdir(directory)) {
            if (!(/^[a-f0-9]{64}\.gif$/).test(file)) {
                continue;
            }
            const id = file.slice(0, -4);
            const stat = await fs.lstat(path.join(directory, file));
            if (!stat.isFile() || stat.isSymbolicLink()) {
                continue;
            }
            let name = 'GIF';
            try {
                const metadata = JSON.parse(await fs.readFile(path.join(directory, `${id}.json`), 'utf8'));
                if (typeof metadata.name === 'string') {
                    name = metadata.name.slice(0, 180);
                }
            } catch {
                // An interrupted metadata write must not hide the GIF itself.
            }
            items.push({id, name, size: stat.size});
        }
        this.items = items.sort((a, b) => a.name.localeCompare(b.name));
        return this.items;
    }

    private async perform(request: GifRequest): Promise<GifResponse> {
        const items = await this.list();
        if (request.op === 'list') {
            return {items};
        }
        if (request.op === 'import') {
            const bytes = Buffer.from(request.data, 'base64');
            if (bytes.length > GIF_FILE_LIMIT) {
                return {error: 'fileLimit'};
            }
            if (bytes.length < 14 || !['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)) || bytes[bytes.length - 1] !== 0x3b) {
                return {error: 'invalid'};
            }
            const width = bytes.readUInt16LE(6);
            const height = bytes.readUInt16LE(8);
            if (!width || !height || width > 2048 || height > 2048) {
                return {error: 'dimensions'};
            }
            if (!isSupportedGif(bytes)) {
                return {error: 'invalid'};
            }
            const id = createHash('sha256').update(bytes).digest('hex');
            if (items.some((item) => item.id === id)) {
                return {duplicate: true};
            }
            if (items.length >= GIF_ITEM_LIMIT || items.reduce((sum, item) => sum + item.size, 0) + bytes.length > GIF_LIBRARY_LIMIT) {
                return {error: 'libraryLimit'};
            }
            const file = path.join(this.directory(), `${id}.gif`);
            const temporary = `${file}.tmp`;

            // Strip control characters and path separators from display names.
            // eslint-disable-next-line no-control-regex
            const name = request.name.replace(/[\x00-\x1f\\/]/g, '_').slice(0, 180) || 'GIF';
            await fs.writeFile(temporary, bytes, {flag: 'w'});
            await fs.rename(temporary, file);
            await fs.writeFile(path.join(this.directory(), `${id}.json`), JSON.stringify({name}));
            this.items = [...items, {id, name, size: bytes.length}].sort((a, b) => a.name.localeCompare(b.name));
            return {};
        }
        if (!(/^[a-f0-9]{64}$/).test(request.id) || !items.some((item) => item.id === request.id)) {
            return {error: 'missing'};
        }
        const file = path.join(this.directory(), `${request.id}.gif`);
        if (request.op === 'read') {
            const item = items.find((entry) => entry.id === request.id)!;
            if (item.size > GIF_FILE_LIMIT) {
                return {error: 'fileLimit'};
            }
            return {data: (await fs.readFile(file)).toString('base64')};
        }
        await fs.unlink(file);
        await fs.unlink(path.join(this.directory(), `${request.id}.json`)).catch(() => undefined);
        this.items = items.filter((item) => item.id !== request.id);
        return {};
    }
}
