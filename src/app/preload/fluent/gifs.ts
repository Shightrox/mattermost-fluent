// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-await-in-loop, no-loop-func */
// Decode/import sequentially to bound memory; event callbacks intentionally read current UI state.

import {ipcRenderer} from 'electron';

import {PERSONAL_GIFS} from 'common/communication';
import {isSupportedGif} from 'common/personalGifs';

import {GIF_FILE_LIMIT, GIF_ITEM_LIMIT, GIF_LIBRARY_LIMIT} from 'types/personalGifs';
import type {GifRequest, GifResponse, PersonalGif} from 'types/personalGifs';

// Private preload-only bridge. No filesystem paths or API are exposed to the page.
export function createPersonalGifs(doc: Document, win: Window) {
    const ru = () => doc.documentElement.lang.startsWith('ru') || win.navigator.language.startsWith('ru');
    const t = (russian: string, english: string) => (ru() ? russian : english);
    const call = async (request: GifRequest): Promise<GifResponse> => {
        try {
            return await ipcRenderer.invoke(PERSONAL_GIFS, request) ?? {error: 'storage'};
        } catch {
            return {error: 'storage'};
        }
    };
    let enabled = false;
    let panel: HTMLElement | undefined;
    let target: HTMLElement | undefined;
    let trigger: HTMLElement | undefined;
    let route = '';
    let threadRoot: Element | null = null;
    let items: PersonalGif[] = [];
    let page = 0;
    let busy = false;
    let generation = 0;
    let scanTimer = 0;
    let lastEditor: HTMLElement | undefined;
    let walkedEntries = 0;
    const inertNodes: Array<{node: HTMLElement; inert: boolean}> = [];
    const buttons = new Set<HTMLElement>();
    const urls = new Set<string>();
    type Preview = {visible: boolean; hovering: boolean; start: () => void; stop: () => void};
    const previews = new Map<HTMLElement, Preview>();
    const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
    let previewObserver: IntersectionObserver | undefined;
    const refreshPreviews = () => {
        const allowed = !doc.hidden && !reducedMotion.matches && doc.documentElement.dataset.mmFluentMotion !== 'off';
        const visible = allowed ? [...previews.entries()].filter(([node, preview]) => node.isConnected && preview.visible) : [];
        visible.sort((a, b) => Number(b[1].hovering) - Number(a[1].hovering));
        const selected = new Set(visible.slice(0, 6).map(([, preview]) => preview));
        previews.forEach((preview) => {
            if (!selected.has(preview)) {
                preview.stop();
            }
        });
        selected.forEach((preview) => preview.start());
    };
    const revoke = () => {
        previewObserver?.disconnect();
        previews.forEach((preview) => preview.stop());
        previews.clear();
        urls.forEach((url) => URL.revokeObjectURL(url));
        urls.clear();
    };
    const close = () => {
        generation++;
        panel?.closest('#emojiGifPicker')?.removeAttribute('data-fluent-gifs-open');
        inertNodes.splice(0).forEach(({node, inert}) => {
            node.inert = inert;
        });
        panel?.remove();
        panel = undefined;
        revoke();
        trigger?.setAttribute('aria-expanded', 'false');
    };
    const button = (text: string, action: (event: MouseEvent) => void) => {
        const element = doc.createElement('button');
        element.type = 'button';
        element.textContent = text;
        element.addEventListener('click', (event) => {
            if (event.isTrusted) {
                action(event);
            }
        });
        return element;
    };
    const message = (text: string) => {
        const status = panel?.querySelector<HTMLElement>('.FluentGifs__status');
        if (status) {
            status.textContent = text;
        }
    };
    const errorText = (error: string) => {
        const errors: Record<string, string> = {
            fileLimit: t('GIF больше 8 МБ.', 'GIF exceeds 8 MB.'),
            dimensions: t('Максимальный размер GIF — 2048 × 2048.', 'Maximum GIF dimensions: 2048 × 2048.'),
            libraryLimit: t('Библиотека заполнена: максимум 1 ГБ или 500 GIF.', 'Library full: maximum 1 GB or 500 GIFs.'),
            invalid: t('Файл не является поддерживаемой GIF.', 'This file is not a supported GIF.'),
            missing: t('GIF уже удалена. Откройте библиотеку заново.', 'GIF was removed. Reopen the library.'),
        };
        return errors[error] ?? t('Не удалось открыть локальную библиотеку.', 'Could not access the local library.');
    };
    const blob = (data: string) => new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], {type: 'image/gif'});
    const objectURL = (value: Blob) => {
        const url = URL.createObjectURL(value);
        urls.add(url);
        return url;
    };
    const attach = async (item: PersonalGif) => {
        if (busy) {
            return;
        }
        const editor = target;
        const originalPanel = panel;
        busy = true;
        try {
            const response = await call({op: 'read', id: item.id});
            if (response.error || !response.data) {
                message(errorText(response.error ?? 'missing'));
                return;
            }

            // Never insert into a different channel or a replaced thread composer.
            if (!panel || panel !== originalPanel || win.location.href !== route || !editor?.isConnected ||
                (editor.closest('#sidebar-right')?.querySelector('[data-testid="rhsPostView"]') ?? null) !== threadRoot) {
                close();
                return;
            }
            const input = editor.querySelector<HTMLInputElement>('input[type="file"]') ?? editor.closest('form')?.querySelector<HTMLInputElement>('input[type="file"]');
            if (!input || input.disabled) {
                message(t('В этом редакторе загрузка вложений недоступна.', 'Attachments are unavailable in this composer.'));
                return;
            }
            const transfer = new DataTransfer();
            transfer.items.add(new File([blob(response.data)], item.name.replace(/\.gif$/i, '') + '.gif', {type: 'image/gif'}));
            input.files = transfer.files;
            input.dispatchEvent(new Event('change', {bubbles: true}));
            close();
            editor.querySelector<HTMLTextAreaElement>('textarea')?.focus();
        } finally {
            busy = false;
        }
    };
    const render = async () => {
        const grid = panel?.querySelector<HTMLElement>('.FluentGifs__grid');
        if (!grid) {
            return;
        }
        const token = ++generation;
        revoke();
        grid.replaceChildren();
        previewObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const preview = previews.get(entry.target as HTMLElement);
                if (preview) {
                    preview.visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
                }
            }
            refreshPreviews();
        }, {root: grid, threshold: [0, 0.25]});
        const query = panel?.querySelector<HTMLInputElement>('input[type="search"]')?.value.toLocaleLowerCase() ?? '';
        const matches = items.filter((item) => item.name.toLocaleLowerCase().includes(query));
        page = Math.min(page, Math.max(0, Math.ceil(matches.length / 24) - 1));
        const shown = matches.slice(page * 24, (page + 1) * 24);
        const pagination = panel?.querySelector<HTMLElement>('.FluentGifs__pages');
        if (pagination) {
            pagination.replaceChildren();
            if (matches.length > 24) {
                const previous = button('←', () => {
                    page--;
                    render();
                });
                previous.disabled = page === 0;
                previous.setAttribute('aria-label', t('Предыдущая страница', 'Previous page'));
                const next = button('→', () => {
                    page++;
                    render();
                });
                next.disabled = (page + 1) * 24 >= matches.length;
                next.setAttribute('aria-label', t('Следующая страница', 'Next page'));
                pagination.append(previous, `${page + 1} / ${Math.ceil(matches.length / 24)}`, next);
            }
        }
        for (const item of shown) {
            if (token !== generation || doc.hidden) {
                return;
            }
            const card = doc.createElement('div');
            card.className = 'FluentGifs__card';
            const use = button(item.name, () => attach(item));
            use.className = 'FluentGifs__use';
            use.title = item.name;
            const label = doc.createElement('span');
            label.textContent = item.name;
            use.replaceChildren(label);
            const remove = button('×', async () => {
                if (busy || !win.confirm(t('Удалить GIF из локальной библиотеки?', 'Remove GIF from the local library?'))) {
                    return;
                }
                const result = await call({op: 'remove', id: item.id});
                if (result.error) {
                    message(errorText(result.error));
                } else {
                    items = items.filter((entry) => entry.id !== item.id);
                    render();
                }
            });
            remove.className = 'FluentGifs__remove';
            remove.setAttribute('aria-label', t('Удалить ', 'Remove ') + item.name);
            card.append(use, remove);
            grid.append(card);
            const response = await call({op: 'read', id: item.id});
            if (token !== generation) {
                return;
            }
            if (!response.data) {
                continue;
            }
            try {
                const gif = blob(response.data);
                const bitmap = await createImageBitmap(gif);
                if (token !== generation) {
                    bitmap.close();
                    return;
                }
                const canvas = doc.createElement('canvas');
                const scale = Math.min(160 / bitmap.width, 120 / bitmap.height, 1);
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                bitmap.close();
                const animated = doc.createElement('img');
                animated.alt = '';
                use.prepend(canvas);
                let animationURL: string | undefined;
                let active = false;
                let requestId = 0;
                const preview: Preview = {
                    visible: false,
                    hovering: false,
                    start: async () => {
                        if (active) {
                            return;
                        }
                        active = true;
                        const pending = ++requestId;
                        const animation = await call({op: 'read', id: item.id});
                        if (!active || pending !== requestId || token !== generation || doc.hidden || !animation.data) {
                            return;
                        }
                        animationURL = objectURL(blob(animation.data));
                        animated.src = animationURL;
                        canvas.replaceWith(animated);
                    },
                    stop: () => {
                        active = false;
                        requestId++;
                        animated.replaceWith(canvas);
                        animated.removeAttribute('src');
                        if (animationURL) {
                            URL.revokeObjectURL(animationURL);
                            urls.delete(animationURL);
                            animationURL = undefined;
                        }
                    },
                };
                previews.set(use, preview);
                previewObserver.observe(use);
                use.addEventListener('pointerenter', () => {
                    preview.hovering = true;
                    refreshPreviews();
                });
                use.addEventListener('pointerleave', () => {
                    preview.hovering = false;
                    refreshPreviews();
                });
            } catch {
                use.title = t('Не удалось создать превью: ', 'Could not preview: ') + item.name;
            }
        }
        if (token !== generation) {
            return;
        }
        if (!busy) {
            message(`${items.length}/${GIF_ITEM_LIMIT} · ${(items.reduce((sum, item) => sum + item.size, 0) / 1024 / 1024).toFixed(1)} / ${GIF_LIBRARY_LIMIT / 1024 / 1024} MB`);
        }
        if (!matches.length) {
            const empty = doc.createElement('p');
            empty.textContent = t('Перетащите сюда GIF или папку с GIF.', 'Drop GIFs or a folder of GIFs here.');
            grid.append(empty);
        }
    };
    const load = async () => {
        const originalPanel = panel;
        const response = await call({op: 'list'});
        if (!panel || panel !== originalPanel) {
            return;
        }
        if (response.error) {
            message(errorText(response.error));
            return;
        }
        items = response.items ?? [];
        await render();
    };
    const importFiles = async (files: AsyncIterable<File>) => {
        if (busy) {
            return;
        }
        busy = true;
        const originalPanel = panel;
        walkedEntries = 0;
        let added = 0;
        let skipped = 0;
        let visited = 0;
        let lastError = '';
        try {
            for await (const file of files) {
                if (!panel || panel !== originalPanel || ++visited > 2000) {
                    break;
                }
                if (!(/\.gif$/i).test(file.name)) {
                    skipped++;
                    continue;
                }
                if (file.size > GIF_FILE_LIMIT) {
                    lastError = errorText('fileLimit');
                    skipped++;
                    continue;
                }
                message(t('Импорт: ', 'Import: ') + file.name);
                try {
                    if (!isSupportedGif(new Uint8Array(await file.arrayBuffer()))) {
                        skipped++;
                        lastError = errorText('invalid');
                        continue;
                    }
                    const preview = await createImageBitmap(file);
                    const supported = preview.width <= 2048 && preview.height <= 2048;
                    preview.close();
                    if (!supported) {
                        skipped++;
                        lastError = errorText('dimensions');
                        continue;
                    }
                } catch {
                    skipped++;
                    lastError = errorText('invalid');
                    continue;
                }
                const data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                if (!panel || panel !== originalPanel) {
                    break;
                }
                const result = await call({op: 'import', name: file.name.slice(0, 180), data});
                if (result.error || result.duplicate) {
                    skipped++;
                    if (result.error) {
                        lastError = errorText(result.error);
                    }
                    if (result.error === 'libraryLimit') {
                        break;
                    }
                } else {
                    added++;
                }
            }
        } catch {
            lastError = t('Не удалось прочитать часть файлов.', 'Some files could not be read.');
        } finally {
            busy = false;
            if (panel === originalPanel) {
                await load();
                message(t(`Добавлено: ${added}. Пропущено: ${skipped}. `, `Added: ${added}. Skipped: ${skipped}. `) + lastError);
            }
        }
    };
    async function* filesFromList(files: FileList | File[]) {
        for (const file of Array.from(files)) {
            yield file;
        }
    }
    async function* walk(entry: FileSystemEntry, depth = 0): AsyncGenerator<File> {
        if (!panel || ++walkedEntries > 5000) {
            throw new Error('Folder import interrupted');
        }
        if (depth > 12) {
            return;
        }
        if (entry.isFile) {
            yield await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
        } else if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            let batch: FileSystemEntry[];
            do {
                batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
                for (const child of batch) {
                    yield* walk(child, depth + 1);
                }
            } while (batch.length);
        }
    }
    const choose = (folder: boolean) => {
        if (busy) {
            return;
        }
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = 'image/gif,.gif';
        input.multiple = true;
        input.webkitdirectory = folder;
        input.addEventListener('change', () => {
            if (input.files) {
                importFiles(filesFromList(input.files));
            }
        }, {once: true});
        input.click();
    };
    const open = (source: HTMLElement, picker?: HTMLElement) => {
        close();
        target = lastEditor;
        if (!target?.isConnected) {
            return;
        }
        route = win.location.href;
        page = 0;
        threadRoot = target.closest('#sidebar-right')?.querySelector('[data-testid="rhsPostView"]') ?? null;
        trigger = source;
        source.setAttribute('aria-expanded', 'true');
        if (picker) {
            let branch = picker.querySelector<HTMLElement>('.nav-tabs, [role="tablist"]');
            while (branch && branch !== picker && branch.parentElement) {
                for (const sibling of Array.from(branch.parentElement.children)) {
                    if (sibling !== branch && sibling instanceof HTMLElement) {
                        inertNodes.push({node: sibling, inert: sibling.inert});
                        sibling.inert = true;
                    }
                }
                branch = branch.parentElement;
            }
        }
        const element = doc.createElement('section');
        element.className = 'FluentGifs' + (picker ? ' FluentGifs--tab' : '');
        if (picker) {
            picker.setAttribute('data-fluent-gifs-open', '');
            const tabs = picker.querySelector('.nav-tabs, [role="tablist"]');
            if (tabs) {
                element.style.top = `${tabs.getBoundingClientRect().bottom - picker.getBoundingClientRect().top}px`;
            }
        }
        element.setAttribute('aria-label', t('Мои GIF', 'My GIFs'));
        element.setAttribute('role', picker ? 'tabpanel' : 'dialog');
        const heading = doc.createElement('header');
        const title = doc.createElement('strong');
        title.textContent = t('Мои GIF', 'My GIFs');
        const exit = button('×', () => {
            close();
            source.focus();
        });
        exit.setAttribute('aria-label', t('Закрыть', 'Close'));
        heading.append(title, exit);
        const search = doc.createElement('input');
        search.type = 'search';
        search.placeholder = t('Поиск по имени', 'Search by name');
        search.setAttribute('aria-label', search.placeholder);
        search.addEventListener('input', () => {
            page = 0;
            render();
        });
        const actions = doc.createElement('nav');
        actions.append(button(t('Добавить GIF', 'Add GIFs'), () => choose(false)), button(t('Папка', 'Folder'), () => choose(true)));
        const grid = doc.createElement('div');
        grid.className = 'FluentGifs__grid';
        const status = doc.createElement('p');
        status.className = 'FluentGifs__status';
        status.setAttribute('role', 'status');
        status.textContent = t('Загрузка…', 'Loading…');
        const pagination = doc.createElement('nav');
        pagination.className = 'FluentGifs__pages';
        element.append(heading, search, actions, grid, pagination, status);
        element.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        element.addEventListener('drop', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!event.isTrusted || !event.dataTransfer) {
                return;
            }
            const entries = Array.from(event.dataTransfer.items).map((item) => item.webkitGetAsEntry()).filter((entry): entry is FileSystemEntry => Boolean(entry?.isDirectory));
            const files = Array.from(event.dataTransfer.items).filter((item) => !item.webkitGetAsEntry()?.isDirectory).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file));
            if (entries.length) {
                async function* dropped() {
                    yield* filesFromList(files);
                    for (const entry of entries) {
                        yield* walk(entry);
                    }
                }
                importFiles(dropped());
            } else {
                importFiles(filesFromList(files));
            }
        });
        panel = element;
        (picker ?? doc.body).append(element);
        search.focus();
        load();
    };
    const scan = () => {
        if (!enabled) {
            return;
        }
        if (panel && (!target?.isConnected || win.location.href !== route || !panel.isConnected)) {
            close();
        }
        buttons.forEach((item) => {
            if (!item.isConnected) {
                buttons.delete(item);
            }
        });
        doc.querySelectorAll<HTMLElement>('.AdvancedTextEditor').forEach((editor) => {
            if (!editor.querySelector('#post_textbox, #reply_textbox')) {
                return;
            }
            const actions = editor.querySelector<HTMLElement>('.mm-fluent-editor-actions') ?? editor.querySelector<HTMLElement>('#toggleFormattingBarButton')?.parentElement;
            if (!actions || actions.querySelector('.FluentGifsTrigger')) {
                return;
            }
            const entry = button('GIF', () => {
                lastEditor = editor;
                open(entry);
            });
            entry.title = t('Мои GIF', 'My GIFs');
            entry.setAttribute('aria-label', entry.title);
            entry.setAttribute('aria-haspopup', 'dialog');
            entry.className = 'FluentGifsTrigger';
            actions.prepend(entry);
            buttons.add(entry);
        });
        const picker = doc.querySelector<HTMLElement>('#emojiGifPicker');
        const tabs = picker?.querySelector<HTMLElement>('.nav-tabs, [role="tablist"]');
        if (picker && tabs && !tabs.querySelector('.FluentGifsTab')) {
            const slot = doc.createElement('li');
            slot.className = 'FluentGifsTab';
            const entry = button(t('Мои GIF', 'My GIFs'), () => open(entry, picker));
            const reference = Array.from(tabs.querySelectorAll<HTMLElement>('button, a')).at(-1);
            if (reference) {
                const icon = reference.querySelector('svg, .icon, i');
                if (icon) {
                    const copy = icon.cloneNode(true) as Element;
                    copy.removeAttribute('id');
                    copy.setAttribute('aria-hidden', 'true');
                    entry.prepend(copy);
                }
            }
            slot.append(entry);
            tabs.append(slot);
            buttons.add(slot);
        }
    };
    const click = (event: MouseEvent) => {
        if (!event.isTrusted || !(event.target instanceof Element)) {
            return;
        }
        const editor = event.target.closest<HTMLElement>('.AdvancedTextEditor');
        if (editor) {
            lastEditor = editor;
        }
        if (panel && !panel.contains(event.target) && !trigger?.contains(event.target)) {
            close();
        }
    };
    const escape = (event: KeyboardEvent) => {
        if (panel && event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            close();
            trigger?.focus();
        }
    };
    const observer = new MutationObserver((records) => {
        if (!scanTimer && records.some((record) => !panel?.contains(record.target) && (record.addedNodes.length || record.removedNodes.length))) {
            scanTimer = win.setTimeout(() => {
                scanTimer = 0;
                scan();
            }, 120);
        }
    });
    const visibility = () => {
        if (doc.hidden) {
            generation++;
            refreshPreviews();
        } else if (panel) {
            render();
        }
    };
    const motionObserver = new MutationObserver(refreshPreviews);
    const update = (active: boolean) => {
        if (enabled === active) {
            return;
        }
        enabled = active;
        if (active) {
            doc.addEventListener('visibilitychange', visibility);
            reducedMotion.addEventListener('change', refreshPreviews);
            motionObserver.observe(doc.documentElement, {attributes: true, attributeFilter: ['data-mm-fluent-motion']});
            observer.observe(doc.body, {childList: true, subtree: true});
            doc.addEventListener('click', click, true);
            doc.addEventListener('keydown', escape, true);
            scan();
        } else {
            doc.removeEventListener('visibilitychange', visibility);
            reducedMotion.removeEventListener('change', refreshPreviews);
            motionObserver.disconnect();
            close();
            observer.disconnect();
            win.clearTimeout(scanTimer);
            scanTimer = 0;
            doc.removeEventListener('click', click, true);
            doc.removeEventListener('keydown', escape, true);
            buttons.forEach((item) => item.remove());
            buttons.clear();
        }
    };
    return {update, dispose: () => update(false)};
}
