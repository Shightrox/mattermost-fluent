// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const GIF_FILE_LIMIT = 8 * 1024 * 1024;
export const GIF_LIBRARY_LIMIT = 1024 * 1024 * 1024;
export const GIF_ITEM_LIMIT = 500;
export type PersonalGif = {id: string; name: string; size: number};
export type GifRequest = {op: 'list'} | {op: 'read' | 'remove'; id: string} | {op: 'import'; name: string; data: string};
export type GifResponse = {items?: PersonalGif[]; data?: string; error?: string; duplicate?: boolean};
