// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isSupportedGif} from './personalGifs';

const gif = () => Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
test('accepts a complete GIF and rejects truncated image data', () => {
    expect(isSupportedGif(gif())).toBe(true);
    expect(isSupportedGif(gif().subarray(0, -1))).toBe(false);
    const broken = gif();
    broken[broken.length - 4] = 255;
    expect(isSupportedGif(broken)).toBe(false);
});
test('rejects a frame larger than the logical image before decoding', () => {
    const bytes = gif();
    const descriptor = bytes.indexOf(0x2c);
    bytes.writeUInt16LE(4096, descriptor + 5);
    expect(isSupportedGif(bytes)).toBe(false);
});
test('rejects empty and non-GIF content', () => {
    expect(isSupportedGif(new Uint8Array())).toBe(false);
    expect(isSupportedGif(Buffer.from('GIF89a________;'))).toBe(false);
});
