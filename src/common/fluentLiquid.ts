// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// One bounded, pointer-transparent surface. Nothing runs while the pointer rests.
// Native controls retain hit testing, focus, routing and drag behavior.
export function createFluentLiquid(doc: Document, win: Window) {
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    const controls = 'button, .btn, .SidebarLink, .SettingsModal__category, [role="menuitem"]';
    let enabled = false;
    let target: HTMLElement | null = null;
    let host: HTMLDivElement | null = null;
    let glow: HTMLDivElement | null = null;
    let ripple: HTMLDivElement | null = null;
    let animation: Animation | undefined;
    let frame = 0;
    let x = 0;
    let y = 0;
    let pressed = false;
    const hide = () => {
        win.cancelAnimationFrame(frame);
        frame = 0;
        target = null;
        pressed = false;
        animation?.cancel();
        animation = undefined;
        if (host) {
            host.hidden = true;
        }
    };
    const paint = () => {
        frame = 0;
        if (!enabled || reduced.matches || doc.hidden || !target?.isConnected) {
            hide();
            return;
        }
        const box = target.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0 || box.width > 600 || box.height > 100 || x < box.left || x > box.right || y < box.top || y > box.bottom) {
            hide();
            return;
        }
        const radius = win.getComputedStyle(target).borderRadius;
        const viewport = target.closest('.simplebar-content-wrapper, .SettingsModal__content, .Menu__content')?.getBoundingClientRect();
        const clip = viewport ? `inset(${Math.max(0, viewport.top - box.top)}px ${Math.max(0, box.right - viewport.right)}px ${Math.max(0, box.bottom - viewport.bottom)}px ${Math.max(0, viewport.left - box.left)}px)` : 'none';
        if (!host) {
            host = doc.createElement('div');
            host.setAttribute('data-fluent-liquid', '');
            host.setAttribute('aria-hidden', 'true');
            glow = doc.createElement('div');
            glow.className = 'fluent-liquid-glow';
            ripple = doc.createElement('div');
            ripple.className = 'fluent-liquid-ripple';
            host.append(glow, ripple);
            doc.documentElement.append(host);
        }
        host.hidden = false;
        host.style.cssText = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;border-radius:${radius};clip-path:${clip}`;
        glow!.style.transform = `translate(${x - box.left - 70}px, ${y - box.top - 70}px)`;
        if (pressed) {
            pressed = false;
            animation?.cancel();
            const size = Math.hypot(box.width, box.height) * 2;
            ripple!.style.cssText = `left:${x - box.left - (size / 2)}px;top:${y - box.top - (size / 2)}px;width:${size}px;height:${size}px`;
            animation = ripple!.animate([{transform: 'scale(0)', opacity: 0.26}, {transform: 'scale(1)', opacity: 0}], {duration: 460, easing: 'cubic-bezier(.16,1,.3,1)'});
        }
    };
    const schedule = (event: PointerEvent) => {
        x = event.clientX;
        y = event.clientY;
        if (!frame) {
            frame = win.requestAnimationFrame(paint);
        }
    };
    const over = (event: PointerEvent) => {
        if (!enabled || reduced.matches || doc.hidden || event.pointerType !== 'mouse' || event.buttons) {
            hide();
            return;
        }
        const next = event.target instanceof Element ? event.target.closest<HTMLElement>(controls) : null;
        if (!next || next.closest('[disabled], [aria-disabled="true"], [inert]') || next.matches('input, textarea')) {
            hide();
            return;
        }
        if (next !== target) {
            hide();
            target = next;
        }
        schedule(event);
    };
    const move = (event: PointerEvent) => {
        if (event.buttons) {
            hide();
        } else if (target) {
            schedule(event);
        }
    };
    const down = (event: PointerEvent) => {
        if (event.button === 0 && target?.contains(event.target as Node)) {
            pressed = true;
            schedule(event);
        }
    };
    doc.addEventListener('pointerover', over, {passive: true});
    doc.addEventListener('pointermove', move, {passive: true});
    doc.addEventListener('pointerdown', down, {passive: true});
    doc.addEventListener('pointerleave', hide, {passive: true});
    doc.addEventListener('scroll', hide, {capture: true, passive: true});
    doc.addEventListener('visibilitychange', hide);
    win.addEventListener('blur', hide);
    win.addEventListener('resize', hide);
    reduced.addEventListener('change', hide);
    return {
        update(active: boolean) {
            enabled = active;
            if (!active) {
                hide();
                host?.remove();
                host = null;
                glow = null;
                ripple = null;
            }
        },
        dispose() {
            hide();
            host?.remove();
            doc.removeEventListener('pointerover', over);
            doc.removeEventListener('pointermove', move);
            doc.removeEventListener('pointerdown', down);
            doc.removeEventListener('pointerleave', hide);
            doc.removeEventListener('scroll', hide, true);
            doc.removeEventListener('visibilitychange', hide);
            win.removeEventListener('blur', hide);
            win.removeEventListener('resize', hide);
            reduced.removeEventListener('change', hide);
        },
    };
}
