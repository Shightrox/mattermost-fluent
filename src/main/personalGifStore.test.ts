// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import {GIF_FILE_LIMIT} from 'types/personalGifs';

import {PersonalGifStore} from './personalGifStore';

const data = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
let directory: string;
let store: PersonalGifStore;
beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fluent-gif-test-'));
    store = new PersonalGifStore(() => directory);
});
afterEach(async () => {
    for (const file of await fs.readdir(directory)) {
        await fs.unlink(path.join(directory, file));
    }
    await fs.rmdir(directory);
});

test('persists GIFs across instances and reads the original bytes', async () => {
    expect(await store.request({op: 'import', name: 'hello.gif', data})).toEqual({});
    const reopened = new PersonalGifStore(() => directory);
    const {items} = await reopened.request({op: 'list'});
    expect(items).toHaveLength(1);
    expect(items![0].name).toBe('hello.gif');
    expect(await reopened.request({op: 'read', id: items![0].id})).toEqual({data});
});
test('deduplicates concurrent imports by content', async () => {
    const result = await Promise.all([store.request({op: 'import', name: 'one.gif', data}), store.request({op: 'import', name: 'two.gif', data})]);
    expect(result).toEqual([{}, {duplicate: true}]);
    expect((await store.request({op: 'list'})).items).toHaveLength(1);
});
test('rejects invalid files, oversized payloads and excessive dimensions', async () => {
    expect(await store.request({op: 'import', name: 'fake.gif', data: Buffer.from('not a gif').toString('base64')})).toEqual({error: 'invalid'});
    expect(await store.request({op: 'import', name: 'big.gif', data: Buffer.alloc(GIF_FILE_LIMIT + 1).toString('base64')})).toEqual({error: 'fileLimit'});
    const wide = Buffer.from(data, 'base64');
    wide.writeUInt16LE(4096, 6);
    expect(await store.request({op: 'import', name: 'wide.gif', data: wide.toString('base64')})).toEqual({error: 'dimensions'});
    expect((await store.request({op: 'list'})).items).toEqual([]);
});
test('rejects arbitrary paths and deletes only a library item', async () => {
    await store.request({op: 'import', name: '../hello.gif', data});
    expect(await store.request({op: 'read', id: '../secret'})).toEqual({error: 'missing'});
    const {items} = await store.request({op: 'list'});
    expect(items![0].name).toBe('.._hello.gif');
    expect(await store.request({op: 'remove', id: items![0].id})).toEqual({});
    expect(await store.request({op: 'read', id: items![0].id})).toEqual({error: 'missing'});
    expect((await store.request({op: 'list'})).items).toEqual([]);
});
