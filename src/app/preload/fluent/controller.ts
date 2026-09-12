// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createFluentLiquid} from 'common/fluentLiquid';
import {createFluentScroll} from 'common/fluentScroll';

import type {FluentViewSettings} from 'types/fluent';

import {createFluentComposer} from './composer';
import {createFluentContext} from './context';
import {createFluentEntrances} from './entrances';
import {createFluentMedia} from './media';
import {createFluentNavigation} from './navigation';
import {createFluentPersonal} from './personal';
import {createFluentSpacing} from './spacing';

// Feature detection, not server-version gating: an unfamiliar UI stays untouched.
const SIDEBAR = '#SidebarContainer, #sidebar-left';
const ROW = '.SidebarChannel .SidebarLink';

export function isFluentServerPage(pageURL: string, serverURL: string): boolean {
    try {
        const page = new URL(pageURL);
        const server = new URL(serverURL);
        const base = server.pathname.replace(/\/$/, '');
        return ['https:', 'http:'].includes(server.protocol) && page.origin === server.origin &&
            (page.pathname === base || page.pathname.startsWith(`${base}/`));
    } catch {
        return false;
    }
}

export function createFluentController(doc: Document, win: Window) {
    let settings: FluentViewSettings | undefined;
    let sidebar: HTMLElement | null = null;
    let surface: HTMLElement | null = null;
    let header: HTMLElement | null = null;
    let previousFocus: HTMLElement | null = null;
    let toolbarClosedAt = -Infinity;
    let restoreFocusTimer = 0;
    let target: HTMLElement | null = null;
    let marker: HTMLDivElement | null = null;
    let frame = 0;
    let probeFrame = 0;
    let attached = false;
    let disposed = false;
    let needsFullScan = true;
    const root = doc.documentElement;
    const scrolling = createFluentScroll(doc, win);
    const liquid = createFluentLiquid(doc, win);
    const navigation = createFluentNavigation(doc, win);
    const context = createFluentContext(doc, win);
    const composer = createFluentComposer();
    const media = createFluentMedia();
    const entrances = createFluentEntrances(win);
    const personal = createFluentPersonal(doc, win);
    const spacing = createFluentSpacing(doc);
    let lastRoute = win.location.pathname;
    const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
    let title: HTMLElement | null = null;
    let titleText = '';
    let titleAnimation: Animation | undefined;
    const stopTitleAnimation = () => {
        titleAnimation?.cancel();
        titleAnimation = undefined;
    };
    const titleObserver = new MutationObserver(() => {
        const next = title?.textContent ?? '';
        if (next === titleText) {
            return;
        }
        titleText = next;
        stopTitleAnimation();
        if (settings?.enabled && settings.motion && !reducedMotion.matches) {
            titleAnimation = title?.animate([{opacity: 0.25}, {opacity: 1}], {duration: 280, easing: 'ease-out'});
        }
    });
    const watchTitle = () => {
        const next = doc.querySelector<HTMLElement>('#channel-header .heading, #channel-header .channel-header__title');
        if (next === title) {
            return;
        }
        titleObserver.disconnect();
        stopTitleAnimation();
        title = next;
        titleText = title?.textContent ?? '';
        if (title) {
            titleObserver.observe(title, {childList: true, characterData: true, subtree: true});
        }
    };
    reducedMotion.addEventListener('change', stopTitleAnimation);
    const editorReferences = new Map<HTMLElement, HTMLTextAreaElement>();
    const resizeEditors = new ResizeObserver((entries) => {
        // Read all measurements first. Only our minimum-height property is owned;
        // the webapp still owns value, selection, max-height and its inline height.
        const changes = entries.flatMap(({target: reference}) => {
            const editor = editorReferences.get(reference as HTMLElement);
            if (!editor?.isConnected || !reference.isConnected) {
                resizeEditors.unobserve(reference);
                editorReferences.delete(reference as HTMLElement);
                editor?.style.removeProperty('--fluent-editor-height');
                return [];
            }
            const style = win.getComputedStyle(editor);
            const minimum = parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 1;
            const maximum = parseFloat(style.maxHeight);
            const height = Math.min(Math.max((reference as HTMLElement).scrollHeight, minimum), maximum > 0 ? maximum : Infinity);
            return [{editor, height: `${Math.ceil(height)}px`}];
        });
        for (const {editor, height} of changes) {
            if (editor.style.getPropertyValue('--fluent-editor-height') !== height) {
                editor.style.setProperty('--fluent-editor-height', height);
            }
        }
    });
    const watchEditorReferences = (node: Element) => {
        if (!settings?.enabled || !surface) {
            return;
        }
        composer.scan(node);
        media.scan(node);
        entrances.scan(node, Boolean(settings.motion));
        const selector = '.AdvancedTextEditor .custom-textarea[id$="-reference"]';
        const references = node.matches(selector) ? [node] : node.querySelectorAll(selector);
        for (const reference of references) {
            if (!(reference instanceof HTMLElement) || editorReferences.has(reference)) {
                continue;
            }
            const editor = doc.getElementById(reference.id.slice(0, -'-reference'.length));
            if (editor instanceof HTMLTextAreaElement && editor.closest('.AdvancedTextEditor') === reference.closest('.AdvancedTextEditor')) {
                editorReferences.set(reference, editor);
                resizeEditors.observe(reference);
            }
        }
    };

    const closeToolbar = (restoreFocus = false) => {
        toolbarClosedAt = win.performance.now();
        root.removeAttribute('data-mm-fluent-toolbar-open');
        if (header?.contains(doc.activeElement) && previousFocus?.isConnected) {
            previousFocus.focus();
        }
        if (restoreFocus) {
            win.clearTimeout(restoreFocusTimer);
            restoreFocusTimer = win.setTimeout(() => {
                if (!disposed && !root.hasAttribute('data-mm-fluent-toolbar-open') && previousFocus?.isConnected &&
                    (doc.activeElement === doc.body || header?.contains(doc.activeElement))) {
                    previousFocus.focus();
                }
            }, 0);
        }
    };
    const onOutsidePointer = (event: PointerEvent) => {
        if (header && !header.contains(event.target as Node)) {
            closeToolbar();
        }
    };
    const onToolbarKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && root.hasAttribute('data-mm-fluent-toolbar-open')) {
            closeToolbar(true);
        }
    };
    const onToolbarFocus = (event: FocusEvent) => {
        if (header?.contains(event.target as Node) && root.hasAttribute('data-mm-fluent-compact') && win.performance.now() - toolbarClosedAt > 150) {
            root.setAttribute('data-mm-fluent-toolbar-open', '');
        }
        if (event.target instanceof HTMLElement && !header?.contains(event.target) && event.target.matches('textarea, [contenteditable="true"]')) {
            previousFocus = event.target;
        }
    };
    doc.addEventListener('pointerdown', onOutsidePointer, {passive: true});
    win.addEventListener('keydown', onToolbarKey, true);
    doc.addEventListener('focusin', onToolbarFocus);

    const hide = () => {
        target = null;
        if (frame) {
            win.cancelAnimationFrame(frame);
            frame = 0;
        }
        marker?.removeAttribute('data-visible');
        marker?.removeAttribute('data-tracking');
    };

    const paint = () => {
        frame = 0;
        if (!target?.isConnected || !sidebar?.contains(target) || !marker) {
            hide();
            return;
        }

        // One geometry read per frame, followed by writes. No React/Redux updates.
        const row = target.getBoundingClientRect();
        const bounds = sidebar.getBoundingClientRect();
        const clip = target.closest('.simplebar-content-wrapper')?.getBoundingClientRect() ?? bounds;
        const top = Math.max(row.top, bounds.top, clip.top, 0);
        const bottom = Math.min(row.bottom, bounds.bottom, clip.bottom, win.innerHeight);
        const left = Math.max(row.left, bounds.left);
        const right = Math.min(row.right, bounds.right);
        if (bottom <= top || right <= left) {
            hide();
            return;
        }
        if (marker.hasAttribute('data-visible')) {
            marker.setAttribute('data-tracking', '');
        }
        marker.style.width = `${right - left}px`;
        marker.style.height = `${bottom - top}px`;
        marker.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        marker.setAttribute('data-visible', '');
    };

    const onPointerOver = (event: PointerEvent) => {
        if (event.pointerType === 'touch' || event.buttons) {
            hide();
            return;
        }
        const element = event.target as Element | null;
        const row = element?.closest<HTMLElement>(ROW) ?? null;
        if (!row || !sidebar?.contains(row) || row.closest('.disabled, .dropDisabled')) {
            hide();
            return;
        }
        if (target === row) {
            return;
        }
        target = row;
        if (!frame) {
            frame = win.requestAnimationFrame(paint);
        }
    };

    const detach = () => {
        liquid.update(false);
        spacing.dispose();
        entrances.dispose();
        personal.dispose();
        composer.dispose();
        media.dispose();
        navigation.dispose();
        context.dispose();
        scrolling.update(false);
        titleObserver.disconnect();
        stopTitleAnimation();
        title = null;
        titleText = '';
        resizeEditors.disconnect();
        for (const editor of editorReferences.values()) {
            editor.style.removeProperty('--fluent-editor-height');
        }
        editorReferences.clear();
        hide();
        if (attached) {
            doc.removeEventListener('pointerover', onPointerOver);
            doc.removeEventListener('pointerleave', hide);
            doc.removeEventListener('pointerdown', hide);
            doc.removeEventListener('dragstart', hide);
            doc.removeEventListener('scroll', hide, true);
            win.removeEventListener('blur', hide);
            win.removeEventListener('resize', hide);
            attached = false;
        }
        marker?.remove();
        marker = null;
        sidebar = null;
        surface = null;
        header = null;
        closeToolbar();
        root.removeAttribute('data-mm-fluent-compact');
        root.removeAttribute('data-mm-fluent');
        root.removeAttribute('data-mm-fluent-accent');
        root.removeAttribute('data-mm-fluent-tint');
        root.removeAttribute('data-mm-fluent-text-size');
        root.removeAttribute('data-mm-fluent-theme');
        root.removeAttribute('data-mm-fluent-surface');
        root.removeAttribute('data-mm-fluent-motion');
        root.removeAttribute('data-mm-fluent-material');
        root.style.removeProperty('--fluent-chat-opacity');
    };

    const probe = () => {
        probeFrame = 0;
        if (disposed) {
            return;
        }
        if (!settings?.enabled || !isFluentServerPage(win.location.href, settings.serverURL)) {
            detach();
            return;
        }
        const found = doc.querySelector<HTMLElement>(SIDEBAR);
        const channels = found?.querySelector(ROW) ? found : null;
        const recognized = channels ?? doc.querySelector<HTMLElement>('.header-footer-route');
        if (!recognized) {
            detach();
            return;
        }
        if (surface !== recognized) {
            detach();
            sidebar = channels;
            surface = recognized;
            needsFullScan = true;
        }
        root.setAttribute('data-mm-fluent', '');
        spacing.update(Boolean(channels));

        // Keep wheel interception off the virtual message lists. Chromium owns
        // their scrolling; React owns history anchoring. A document-wide blocking
        // listener and per-frame scrollTo competed with both, including in RHS.
        scrolling.update(settings.motion, recognized);
        liquid.update(settings.motion);
        root.setAttribute('data-mm-fluent-motion', settings.motion ? 'on' : 'off');
        root.setAttribute('data-mm-fluent-accent', settings.accent ?? 'blue');
        root.setAttribute('data-mm-fluent-tint', settings.tint ?? 'neutral');
        root.setAttribute('data-mm-fluent-text-size', settings.textSize ?? 'standard');
        root.setAttribute('data-mm-fluent-material', settings.material);
        const opacity = Number.isFinite(settings.chatOpacity) ? Math.min(100, Math.max(30, settings.chatOpacity!)) : 75;
        root.style.setProperty('--fluent-chat-opacity', `${opacity}%`);
        root.setAttribute('data-mm-fluent-theme', settings.theme === 'light' ? 'light' : 'dark');
        root.setAttribute('data-mm-fluent-surface', channels ? 'channels' : 'auth');
        navigation.update(Boolean(channels));
        context.update(Boolean(channels));
        personal.update(settings, Boolean(channels));
        header = channels ? doc.querySelector<HTMLElement>('#global-header') : null;
        root.toggleAttribute('data-mm-fluent-compact', Boolean(settings.compactHeader && header));
        if (needsFullScan && !doc.hidden) {
            needsFullScan = false;
            watchEditorReferences(root);
        }
        watchTitle();
        if (!sidebar) {
            return;
        }
        if (!marker) {
            marker = doc.createElement('div');
            marker.className = 'mm-fluent-hover';
            marker.setAttribute('aria-hidden', 'true');
            sidebar.append(marker);
        }
        if (!attached) {
            doc.addEventListener('pointerover', onPointerOver, {passive: true});
            doc.addEventListener('pointerleave', hide, {passive: true});
            doc.addEventListener('pointerdown', hide, {passive: true});
            doc.addEventListener('dragstart', hide, {passive: true});
            doc.addEventListener('scroll', hide, {capture: true, passive: true});
            win.addEventListener('blur', hide);
            win.addEventListener('resize', hide);
            attached = true;
        }
    };

    const scheduleProbe = () => {
        if (!probeFrame && settings?.enabled && !disposed) {
            probeFrame = win.requestAnimationFrame(probe);
        }
    };
    const observer = new MutationObserver((records) => {
        if (doc.hidden) {
            needsFullScan = true;
            return;
        }
        const added = new Set<Element>();
        if (lastRoute !== win.location.pathname) {
            lastRoute = win.location.pathname;
            navigation.update(Boolean(settings?.enabled && sidebar));
        }
        for (const record of records) {
            // Channels mounts its navigation asynchronously, after the first
            // channel rows. Limit retries to navigation, never the message feed.
            if (record.target instanceof Element && record.target.closest('#SidebarContainer, #global-header, #channel-header') && !record.target.closest('.FluentNavigation, .FluentPersonal')) {
                scheduleProbe();
            }
            if (Array.from(record.removedNodes).some((node) => node instanceof Element && node.matches('#sidebar-right'))) {
                scheduleProbe();
            }
            for (const node of record.addedNodes) {
                if (node instanceof Element && !node.closest('[data-fluent-liquid]')) {
                    if (node.matches('#SidebarContainer, #global-header, #sidebar-right') || (!root.hasAttribute('data-mm-fluent-context') && node.closest('#sidebar-right'))) {
                        scheduleProbe();
                    }
                    added.add(node);
                    if (surface && !title?.isConnected && (node.matches('#channel-header') || node.closest('#channel-header'))) {
                        watchTitle();
                    }
                }
            }
        }

        // A React commit may report a parent and many of its descendants.
        // Scan each connected branch once, before the next layout measurement.
        for (const node of added) {
            if (!node.isConnected) {
                continue;
            }
            let parent = node.parentElement;
            while (parent && !added.has(parent)) {
                parent = parent.parentElement;
            }
            if (!parent) {
                watchEditorReferences(node);
            }
        }
        if (marker && !marker.isConnected) {
            marker.remove();
            marker = null;
            scheduleProbe();
        }
        if (target && !target.isConnected) {
            hide();
        }

        // Message updates must not cause whole-document scans or per-frame polling.
        if (!surface?.isConnected) {
            scheduleProbe();
        }
        if (surface && settings?.compactHeader && !header?.isConnected) {
            scheduleProbe();
        }
        if (title && !title.isConnected) {
            watchTitle();
        }
    });
    observer.observe(root, {childList: true, subtree: true});
    win.addEventListener('popstate', scheduleProbe);
    const onVisibility = () => {
        if (doc.hidden) {
            hide();
            stopTitleAnimation();
            entrances.dispose();
            scrolling.update(false);
        } else {
            needsFullScan = true;
            scheduleProbe();
        }
    };
    doc.addEventListener('visibilitychange', onVisibility);

    return {
        openToolbar(command: 'search' | 'tools' | 'close') {
            if (!settings?.enabled || !header?.isConnected || !root.hasAttribute('data-mm-fluent-compact')) {
                return;
            }
            if (command === 'close') {
                closeToolbar(true);
                return;
            }
            if (command !== 'search' && command !== 'tools') {
                return;
            }
            const wasOpen = root.hasAttribute('data-mm-fluent-toolbar-open');
            if (!wasOpen && doc.activeElement instanceof HTMLElement && doc.activeElement !== doc.body && !header.contains(doc.activeElement)) {
                previousFocus = doc.activeElement;
            }
            if (command === 'tools' && wasOpen) {
                closeToolbar();
                return;
            }
            toolbarClosedAt = -Infinity;
            root.toggleAttribute('data-mm-fluent-toolbar-open', command === 'search' || !wasOpen);
            if (command === 'search') {
                const search = header.querySelector<HTMLElement>('#searchFormContainer, .GlobalSearchNav [role="button"], .GlobalSearchNav button, .GlobalSearchNav input, #searchBox');
                search?.focus();
                search?.click();
            } else if (!wasOpen) {
                header.querySelector<HTMLElement>('button')?.focus();
            }
        },
        update(next: FluentViewSettings) {
            stopTitleAnimation();
            settings = next;
            needsFullScan = true;
            observer.disconnect();
            if (next.enabled && isFluentServerPage(win.location.href, next.serverURL)) {
                observer.observe(root, {childList: true, subtree: true});
            }
            probe();
        },
        dispose() {
            liquid.dispose();
            entrances.destroy();
            context.destroy();
            scrolling.dispose();
            disposed = true;
            observer.disconnect();
            doc.removeEventListener('visibilitychange', onVisibility);
            reducedMotion.removeEventListener('change', stopTitleAnimation);
            win.removeEventListener('popstate', scheduleProbe);
            doc.removeEventListener('pointerdown', onOutsidePointer);
            win.removeEventListener('keydown', onToolbarKey, true);
            doc.removeEventListener('focusin', onToolbarFocus);
            win.cancelAnimationFrame(probeFrame);
            win.clearTimeout(restoreFocusTimer);
            detach();
        },
    };
}
