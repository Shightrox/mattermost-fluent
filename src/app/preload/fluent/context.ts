// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createFluentSearch} from './search';

// Own the context chrome, while React keeps the panel, editor and permissions.
export function createFluentContext(doc: Document, win: Window) {
    const narrow = win.matchMedia('(max-width: 1100px)');
    let panel: HTMLElement | null = null;
    let toolbar: HTMLElement | null = null;
    let hiddenConversation: HTMLElement | null = null;
    let previousInert = false;
    let channel = '';
    let thread = '';
    let threadScroll = 0;
    let frame = 0;
    let restoreFrame = 0;
    let focusFrame = 0;
    let pendingPins = false;
    let pinsTimer = 0;
    const root = doc.documentElement;
    const search = createFluentSearch(doc, win);
    const original = (id: string) => doc.getElementById(id);
    const closeButton = () => panel?.querySelector<HTMLElement>('#rhsCloseButton, #searchResultsCloseButton');
    const threadButton = () => original(`${thread}_message`)?.querySelector<HTMLElement>('.ReplyButton');
    const saveThread = () => {
        search.capture();
        const post = panel?.querySelector<HTMLElement>('.post--root[id^="rhsPost_"]');
        if (post) {
            thread = post.id.slice('rhsPost_'.length);
            threadScroll = panel?.querySelector('#threadViewerScrollContainer')?.scrollTop ?? 0;
        }
    };
    const restoreConversation = () => {
        if (hiddenConversation) {
            hiddenConversation.inert = previousInert;
            hiddenConversation = null;
        }
    };
    const refresh = () => {
        frame = 0;
        if (!panel?.isConnected || !toolbar?.isConnected) {
            return;
        }
        search.update(true);
        if (pendingPins) {
            const pinAction = original('channelInfoRHSChannelSettings')?.parentElement?.querySelector('.icon-pin-outline')?.closest('button');
            if (pinAction) {
                pendingPins = false;
                win.clearTimeout(pinsTimer);
                pinAction.click();
                return;
            }
        }
        const isThread = Boolean(panel.querySelector('#reply_textbox'));
        const info = Boolean(panel.querySelector('#channelInfoRHSChannelSettings'));
        const files = Boolean(panel.querySelector('.channel-files-container'));
        for (const button of toolbar.querySelectorAll<HTMLButtonElement>('[data-context]')) {
            const key = button.dataset.context;
            let active = false;
            if (key === 'thread') {
                active = isThread;
                button.hidden = !thread && !isThread;
                button.disabled = !isThread && !threadButton();
            } else if (key === 'info') {
                active = info;
                button.disabled = !original('channel-info-btn');
            } else if (key === 'files') {
                active = files;
                button.disabled = !original('channelHeaderFilesButton');
            } else if (key === 'members') {
                active = Boolean(panel.querySelector('.channel-members-rhs'));
                button.disabled = !original('member_rhs');
            } else if (key === 'search') {
                active = Boolean(panel.querySelector('#messagesTab'));
                button.hidden = !active && !search.hasSaved();
                button.disabled = !original('sbrSearchBox')?.closest('form');
            } else if (key === 'pins') {
                button.disabled = !original('channel-info-btn');
            }
            button.setAttribute('aria-pressed', String(active));
        }
        root.toggleAttribute('data-mm-fluent-context-narrow', narrow.matches);
        const conversation = original('channel_view');
        if (hiddenConversation && conversation !== hiddenConversation) {
            restoreConversation();
        }
        if (narrow.matches && conversation && !hiddenConversation) {
            previousInert = conversation.inert;
            hiddenConversation = conversation;
            conversation.inert = true;
            if (conversation.contains(doc.activeElement)) {
                toolbar.querySelector<HTMLButtonElement>('button')?.focus({preventScroll: true});
            }
        } else if (!narrow.matches) {
            restoreConversation();
        }
    };
    const schedule = () => {
        if (!frame && !doc.hidden) {
            frame = win.requestAnimationFrame(refresh);
        }
    };
    const observer = new MutationObserver((records) => {
        if (records.some((record) => !(record.target instanceof Element ? record.target : record.target.parentElement)?.closest('.FluentContext'))) {
            schedule();
        }
    });
    const cancelRestore = () => {
        win.cancelAnimationFrame(restoreFrame);
        restoreFrame = 0;
    };
    const cancelPending = () => {
        pendingPins = false;
        win.clearTimeout(pinsTimer);
        cancelRestore();
        win.cancelAnimationFrame(focusFrame);
        focusFrame = 0;
    };
    const focusConversation = () => {
        // Let the webapp finish its own close/focus lifecycle.
        let attempts = 0;
        const focus = () => {
            focusFrame = 0;
            const editor = original('post_textbox');
            if (!original('sidebar-right')?.classList.contains('is-open') && editor && win.getComputedStyle(editor).visibility === 'visible' && !editor.closest('[inert]')) {
                editor.focus({preventScroll: true});
                if (doc.activeElement === editor) {
                    return;
                }
            }
            if (++attempts < 60) {
                focusFrame = win.requestAnimationFrame(focus);
            }
        };
        focusFrame = win.requestAnimationFrame(focus);
    };
    const openPins = () => {
        pendingPins = true;
        win.clearTimeout(pinsTimer);
        pinsTimer = win.setTimeout(() => {
            pendingPins = false;
        }, 2000);
        if (!original('channelInfoRHSChannelSettings')) {
            original('channel-info-btn')?.click();
        }
    };
    const restoreThread = () => {
        cancelRestore();
        let attempts = 0;
        const restore = () => {
            restoreFrame = 0;
            const scroller = panel?.querySelector<HTMLElement>('#threadViewerScrollContainer');
            const post = panel?.querySelector('.post--root[id^="rhsPost_"]');
            if (post?.id === `rhsPost_${thread}` && scroller && scroller.scrollHeight >= (threadScroll + scroller.clientHeight) - 1) {
                scroller.scrollTop = threadScroll;
            } else if (++attempts < 30) {
                restoreFrame = win.requestAnimationFrame(restore);
            }
        };
        restoreFrame = win.requestAnimationFrame(restore);
    };
    const remove = () => {
        pendingPins = false;
        win.clearTimeout(pinsTimer);
        search.dispose();
        observer.disconnect();
        win.cancelAnimationFrame(frame);
        frame = 0;
        cancelRestore();
        toolbar?.remove();
        toolbar = null;
        panel = null;
        restoreConversation();
        root.removeAttribute('data-mm-fluent-context');
        root.removeAttribute('data-mm-fluent-context-narrow');
    };
    narrow.addEventListener('change', schedule);

    // Capture before React replaces the thread. Store only its ID and position.
    doc.addEventListener('click', saveThread, true);
    doc.addEventListener('wheel', cancelPending, {passive: true});
    doc.addEventListener('pointerdown', cancelPending, {passive: true});
    doc.addEventListener('keydown', cancelPending);
    return {
        update(enabled: boolean) {
            const nextChannel = original('channel-header')?.dataset.channelid ?? '';
            if (!enabled || channel !== nextChannel) {
                search.reset();
                thread = '';
                threadScroll = 0;
                cancelPending();
                channel = nextChannel;
            }
            const conversation = original('channel_view');
            const next = enabled && conversation ? original('sidebar-right') : null;
            if (!next || next.parentElement !== conversation?.parentElement || !next.querySelector('#rhsCloseButton, #searchResultsCloseButton') || !next.querySelector('.sidebar-right-container')) {
                remove();
                return;
            }
            if (panel === next && toolbar?.isConnected) {
                refresh();
                return;
            }
            remove();
            panel = next;
            const russian = doc.documentElement.lang.startsWith('ru') || (/[А-Яа-я]/).test(original('sidebarItem_threads')?.textContent ?? '');
            toolbar = doc.createElement('nav');
            toolbar.className = 'FluentContext';
            toolbar.setAttribute('aria-label', russian ? 'Контекст разговора' : 'Conversation context');
            const definitions = [
                ['back', 'arrow-left', russian ? 'К переписке' : 'Back to conversation'],
                ['info', 'information-outline', russian ? 'Сведения' : 'Info'],
                ['files', 'file-document-outline', russian ? 'Файлы' : 'Files'],
                ['members', 'account-multiple-outline', russian ? 'Участники' : 'Members'],
                ['pins', 'pin-outline', russian ? 'Закреплённое' : 'Pinned messages'],
                ['thread', 'message-text-outline', russian ? 'Обсуждение' : 'Thread'],
                ['search', 'magnify', russian ? 'Результаты' : 'Results'],
            ];
            for (const [key, icon, label] of definitions) {
                const button = doc.createElement('button');
                button.type = 'button';
                button.dataset.context = key;
                button.title = label;
                button.setAttribute('aria-label', label);
                const glyph = doc.createElement('i');
                glyph.className = `icon icon-${icon}`;
                glyph.setAttribute('aria-hidden', 'true');
                const text = doc.createElement('span');
                text.textContent = label;
                button.append(glyph, text);
                button.addEventListener('click', () => {
                    if (button.getAttribute('aria-pressed') === 'true') {
                        return;
                    }
                    if (key === 'back') {
                        closeButton()?.click();
                        remove();
                        focusConversation();
                    } else if (key === 'thread') {
                        threadButton()?.click();
                        restoreThread();
                    } else if (key === 'search') {
                        search.restore();
                    } else if (key === 'pins') {
                        openPins();
                    } else {
                        const ids: Record<string, string> = {info: 'channel-info-btn', files: 'channelHeaderFilesButton', members: 'member_rhs'};
                        original(ids[key])?.click();
                    }
                    schedule();
                });
                toolbar.append(button);
            }
            panel.prepend(toolbar);
            root.setAttribute('data-mm-fluent-context', '');
            observer.observe(panel, {childList: true, subtree: true});
            refresh();
        },
        dispose() {
            search.reset();
            cancelPending();
            remove();
            thread = '';
            channel = '';
        },
        destroy() {
            cancelPending();
            remove();
            narrow.removeEventListener('change', schedule);
            doc.removeEventListener('click', saveThread, true);
            doc.removeEventListener('wheel', cancelPending);
            doc.removeEventListener('pointerdown', cancelPending);
            doc.removeEventListener('keydown', cancelPending);
        },
    };
}
