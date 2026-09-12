// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Presentation adapter for recognized Channels controls. The original React
// controls retain ownership of routing, counts, permissions and drafts.
export function createFluentNavigation(doc: Document, win: Window) {
    let host: HTMLElement | null = null;
    let navigation: HTMLElement | null = null;
    let observedSaved: HTMLButtonElement | null = null;
    let lastConversation = '';
    let frame = 0;
    const root = doc.documentElement;
    const sources = () => ({
        threads: doc.querySelector<HTMLElement>('#sidebarItem_threads'),
        drafts: doc.querySelector<HTMLElement>('#sidebarItem_drafts'),
        saved: doc.querySelector<HTMLElement>('#global-header .icon-bookmark-outline')?.closest('button') ?? null,
    });
    const refresh = () => {
        frame = 0;
        if (!host?.isConnected || !navigation?.isConnected) {
            return;
        }
        const active = host.querySelector<HTMLAnchorElement>('#sidebar-left .SidebarChannel.active .SidebarLink, #sidebar-left .SidebarLink.active');
        if (active) {
            lastConversation = active.getAttribute('href') ?? lastConversation;
        } else if (!lastConversation) {
            lastConversation = host.querySelector('#sidebar-left .SidebarLink[href]')?.getAttribute('href') ?? '';
        }
        const controls = sources();
        const isSectionRoute = (control: HTMLElement | null) => {
            const href = control?.getAttribute('href');
            if (!href) {
                return false;
            }
            const path = new URL(href, win.location.href).pathname.replace(/\/$/, '');
            return win.location.pathname === path || win.location.pathname.startsWith(`${path}/`);
        };
        let selected = 'chats';
        if (controls.saved?.getAttribute('aria-expanded') === 'true') {
            selected = 'saved';
        } else if (isSectionRoute(controls.threads)) {
            selected = 'threads';
        } else if (isSectionRoute(controls.drafts)) {
            selected = 'drafts';
        }
        for (const button of navigation.querySelectorAll<HTMLButtonElement>('[data-section]')) {
            const key = button.dataset.section as 'threads' | 'drafts' | 'saved' | 'chats';
            const original = key === 'chats' ? null : controls[key];
            button.disabled = key === 'chats' ? !lastConversation : !original;
            if (key === selected) {
                button.setAttribute('aria-current', 'page');
            } else {
                button.removeAttribute('aria-current');
            }
            const value = original?.querySelector('.badge')?.textContent?.trim() ?? '';
            const badge = button.querySelector<HTMLElement>('.FluentNavigation__count')!;
            if (badge.textContent !== value) {
                badge.textContent = value;
            }
            badge.hidden = !value;
        }
    };
    const schedule = () => {
        if (!frame && !doc.hidden) {
            frame = win.requestAnimationFrame(refresh);
        }
    };
    const observer = new MutationObserver((records) => {
        if (records.some((record) => !(record.target instanceof Element ? record.target : record.target.parentElement)?.closest('.FluentNavigation'))) {
            schedule();
        }
    });
    const dispose = () => {
        observer.disconnect();
        win.cancelAnimationFrame(frame);
        frame = 0;
        navigation?.remove();
        navigation = null;
        host = null;
        observedSaved = null;
        lastConversation = '';
        root.removeAttribute('data-mm-fluent-navigation');
    };
    const observe = (sidebar: HTMLElement, saved: HTMLButtonElement | null) => {
        observer.disconnect();
        observer.observe(sidebar, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class']});
        observedSaved = saved;
        if (saved) {
            observer.observe(saved, {attributes: true, attributeFilter: ['aria-expanded']});
        }
    };
    return {
        update(enabled: boolean) {
            const sidebar = enabled ? doc.querySelector<HTMLElement>('#SidebarContainer') : null;
            const controls = sources();
            if (!sidebar || !controls.threads) {
                dispose();
                return;
            }
            if (host === sidebar && navigation?.isConnected) {
                if (observedSaved !== controls.saved) {
                    observe(sidebar, controls.saved);
                }
                refresh();
                return;
            }
            dispose();
            host = sidebar;
            const russian = doc.documentElement.lang.startsWith('ru') || (/[А-Яа-я]/).test(controls.threads.textContent ?? '');
            const labels = russian ? ['Переписки', 'Обсуждения', 'Позже', 'Черновики'] : ['Conversations', 'Threads', 'Later', 'Drafts'];
            navigation = doc.createElement('nav');
            navigation.className = 'FluentNavigation';
            navigation.setAttribute('aria-label', russian ? 'Рабочее пространство' : 'Workspace navigation');
            const definitions = [['chats', 'forum-outline'], ['threads', 'message-text-outline'], ['saved', 'bookmark-outline'], ['drafts', 'pencil-outline']];
            definitions.forEach(([section, icon], index) => {
                const button = doc.createElement('button');
                button.type = 'button';
                button.dataset.section = section;
                const glyph = doc.createElement('i');
                glyph.className = `icon icon-${icon}`;
                glyph.setAttribute('aria-hidden', 'true');
                const label = doc.createElement('span');
                label.className = 'FluentNavigation__label';
                label.textContent = labels[index];
                const badge = doc.createElement('span');
                badge.className = 'FluentNavigation__count';
                badge.hidden = true;
                button.append(glyph, label, badge);
                button.addEventListener('click', () => {
                    const current = sources();
                    if (section === 'chats') {
                        const conversation = Array.from(host?.querySelectorAll<HTMLAnchorElement>('#sidebar-left .SidebarLink') ?? []).find((link) => link.getAttribute('href') === lastConversation);
                        if (current.saved?.getAttribute('aria-expanded') === 'true') {
                            current.saved.click();
                        }
                        conversation?.click();
                    } else {
                        current[section as 'threads' | 'drafts' | 'saved']?.click();
                    }
                    schedule();
                });
                navigation!.append(button);
            });
            const navigator = sidebar.querySelector('#lhsNavigator');
            sidebar.insertBefore(navigation, navigator?.parentElement === sidebar ? navigator : null);
            root.setAttribute('data-mm-fluent-navigation', '');
            observe(sidebar, controls.saved);
            refresh();
        },
        dispose,
    };
}
