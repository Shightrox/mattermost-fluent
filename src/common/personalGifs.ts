// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Validate structure before a decoder allocates memory. This is not a codec:
// Chromium still validates the image data when creating the first-frame preview.
export function isSupportedGif(bytes: Uint8Array): boolean {
    if (bytes.length < 14 || !['GIF87a', 'GIF89a'].includes(String.fromCharCode(...bytes.subarray(0, 6)))) {
        return false;
    }
    const word = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
    const width = word(6);
    const height = word(8);
    if (!width || !height || width > 2048 || height > 2048) {
        return false;
    }
    let cursor = 13 + ((bytes[10] & 0x80) ? 3 * (2 ** ((bytes[10] & 7) + 1)) : 0);
    let frames = 0;
    let pixels = 0;
    const blocks = () => {
        while (cursor < bytes.length) {
            const length = bytes[cursor++];
            if (!length) {
                return true;
            }
            cursor += length;
        }
        return false;
    };
    while (cursor < bytes.length) {
        const marker = bytes[cursor++];
        if (marker === 0x3b) {
            return frames > 0 && cursor === bytes.length;
        }
        if (marker === 0x21) {
            cursor++; // extension label
            if (!blocks()) {
                return false;
            }
        } else if (marker === 0x2c) {
            if (cursor + 9 >= bytes.length) {
                return false;
            }
            const frameWidth = word(cursor + 4);
            const frameHeight = word(cursor + 6);
            if (!frameWidth || !frameHeight || word(cursor) + frameWidth > width || word(cursor + 2) + frameHeight > height) {
                return false;
            }
            frames++;
            pixels += width * height;
            if (frames > 600 || pixels > 64 * 1024 * 1024) {
                return false;
            }
            const packed = bytes[cursor + 8];
            cursor += 9 + ((packed & 0x80) ? 3 * (2 ** ((packed & 7) + 1)) : 0);
            const codeSize = bytes[cursor++];
            if (codeSize < 2 || codeSize > 8 || !blocks()) {
                return false;
            }
        } else {
            return false;
        }
    }
    return false;
}
