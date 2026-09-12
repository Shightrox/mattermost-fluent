// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Local presentation only: the webapp still owns formatting commands, drafts,
// attachments and sending. Never click its preference-saving toolbar toggle.
type ComposerEntry = {cleanup: () => void; valid: () => boolean};

export function createFluentComposer() {
    const entries = new Map<HTMLElement, ComposerEntry>();
    const expanded = new Map<string, boolean>();
    const attach = (editor: HTMLElement) => {
        if (entries.has(editor)) {
            return;
        }
        const input = editor.querySelector<HTMLTextAreaElement>('#post_textbox, #reply_textbox');
        const toggle = editor.querySelector<HTMLButtonElement>('#toggleFormattingBarButton');
        const toolbar = editor.querySelector<HTMLElement>('[data-testid="formattingBarContainer"]');
        const cell = editor.querySelector<HTMLElement>('.AdvancedTextEditor__cell');
        const actions = toggle?.parentElement;
        if (!input || !toggle || !toolbar || !cell || actions?.parentElement !== cell) {
            return;
        }
        let slot: HTMLElement = toolbar;
        while (slot.parentElement && slot.parentElement !== cell) {
            slot = slot.parentElement;
        }
        if (slot.parentElement !== cell) {
            return;
        }
        const previousExpanded = toggle.getAttribute('aria-expanded');
        const render = () => {
            const open = expanded.get(input.id) ?? false;
            editor.dataset.fluentTools = open ? 'open' : 'closed';
            toggle.setAttribute('aria-expanded', String(open));
        };
        const onClick = (event: MouseEvent) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            expanded.set(input.id, !(expanded.get(input.id) ?? false));
            render();
            if (event.detail === 0 && expanded.get(input.id)) {
                (toolbar.querySelector<HTMLElement>('#FormattingControl_bold') ?? toolbar.querySelector<HTMLElement>('button'))?.focus();
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && toolbar.contains(event.target as Node) && expanded.get(input.id)) {
                event.preventDefault();
                event.stopPropagation();
                expanded.set(input.id, false);
                render();
                toggle.focus();
            }
        };
        editor.classList.add('mm-fluent-composer');
        cell.classList.add('mm-fluent-editor-cell');
        actions.classList.add('mm-fluent-editor-actions');
        slot.classList.add('mm-fluent-formatting-slot');
        toggle.addEventListener('click', onClick, true);
        editor.addEventListener('keydown', onKeyDown);
        render();
        const cleanup = () => {
            toggle.removeEventListener('click', onClick, true);
            editor.removeEventListener('keydown', onKeyDown);
            if (previousExpanded === null) {
                toggle.removeAttribute('aria-expanded');
            } else {
                toggle.setAttribute('aria-expanded', previousExpanded);
            }
            editor.classList.remove('mm-fluent-composer');
            delete editor.dataset.fluentTools;
            cell.classList.remove('mm-fluent-editor-cell');
            actions.classList.remove('mm-fluent-editor-actions');
            slot.classList.remove('mm-fluent-formatting-slot');
        };
        entries.set(editor, {cleanup, valid: () => toggle.isConnected && slot.isConnected && cell.isConnected && actions.isConnected});
    };
    return {
        scan(node: Element) {
            for (const [editor, entry] of entries) {
                if (!editor.isConnected || !entry.valid()) {
                    entry.cleanup();
                    entries.delete(editor);
                }
            }
            const ancestor = node.closest<HTMLElement>('.AdvancedTextEditor');
            if (ancestor) {
                attach(ancestor);
            } else {
                node.querySelectorAll<HTMLElement>('.AdvancedTextEditor').forEach(attach);
            }
        },
        dispose() {
            entries.forEach((entry) => entry.cleanup());
            entries.clear();
        },
    };
}
