// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// DOM-only shared behavior: no Electron, network or application state access.
export function createFluentScroll(doc: Document, win: Window) {
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    let enabled = false;
    let wheelRoot: Document | HTMLElement = doc;
    let frame = 0;
    let element: HTMLElement | null = null;
    let destination = 0;
    let written = 0;
    let lastTime = 0;
    const stop = () => {
        win.cancelAnimationFrame(frame);
        frame = 0;
        element = null;
    };
    const tick = (time: number) => {
        frame = 0;
        if (!enabled || reduced.matches || !element?.isConnected || Math.abs(element.scrollTop - written) > 2) {
            stop(); // A navigation, scrollbar drag or virtual-list anchor owns the position now.
            return;
        }
        destination = Math.max(0, Math.min(destination, element.scrollHeight - element.clientHeight));
        const amount = 1 - Math.exp(-Math.min(time - lastTime, 40) / 90);
        lastTime = time;
        const remaining = destination - element.scrollTop;
        const step = Math.sign(remaining) * Math.min(Math.abs(remaining), Math.max(1, Math.abs(remaining) * amount));
        element.scrollTo({top: element.scrollTop + step, behavior: 'instant'});
        written = element.scrollTop;
        if (Math.abs(destination - written) > 0.8) {
            frame = win.requestAnimationFrame(tick);
        } else {
            stop();
        }
    };
    const onWheel = (event: WheelEvent) => {
        if (!enabled || reduced.matches || event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey || event.deltaX || !event.deltaY) {
            stop();
            return;
        }

        // Devices aren't identifiable from WheelEvent. Only take clearly stepped
        // line-mode wheels or legacy 120-unit detents; leave precision input native.
        const legacy = (event as WheelEvent & {wheelDeltaY?: number}).wheelDeltaY;
        const stepped = event.deltaMode === 1 || (event.deltaMode === 0 && Math.abs(event.deltaY) >= 50 && Boolean(legacy && Math.abs(legacy) % 120 === 0));
        const origin = event.target instanceof Element ? event.target : null;
        if (!stepped || !origin || origin.closest('textarea, input, [contenteditable="true"], [role="slider"], pre, video, canvas')) {
            stop();
            return;
        }
        let candidate: HTMLElement | null = origin instanceof HTMLElement ? origin : origin.parentElement;
        while (candidate) {
            const style = win.getComputedStyle(candidate);
            const scrollable = ['auto', 'scroll'].includes(style.overflowY) || (candidate === doc.scrollingElement && style.overflowY === 'visible');
            if (scrollable && candidate.scrollHeight > candidate.clientHeight + 1) {
                // Reverse flex scrollers and snap containers keep native semantics.
                if (style.flexDirection === 'column-reverse' || style.scrollSnapType !== 'none') {
                    stop();
                    return;
                }
                const position = candidate.scrollTop;
                const maximum = candidate.scrollHeight - candidate.clientHeight;
                if ((event.deltaY > 0 && position < maximum - 1) || (event.deltaY < 0 && position > 1)) {
                    const delta = event.deltaY * (event.deltaMode === 1 ? parseFloat(style.lineHeight) || 20 : 1);
                    if (candidate !== element) {
                        stop();
                        element = candidate;
                        destination = candidate.scrollTop;
                        written = candidate.scrollTop;
                    }

                    // A direction reversal responds immediately, without old momentum.
                    if (Math.sign(delta) !== Math.sign(destination - candidate.scrollTop)) {
                        destination = candidate.scrollTop;
                    }
                    destination = Math.max(0, Math.min(maximum, destination + delta));
                    event.preventDefault();
                    if (!frame) {
                        lastTime = win.performance.now();
                        frame = win.requestAnimationFrame(tick);
                    }
                    return;
                }
                if (style.overscrollBehaviorY !== 'auto') {
                    stop();
                    return;
                }
            }
            candidate = candidate === wheelRoot ? null : candidate.parentElement;
        }
        stop();
    };
    doc.addEventListener('pointerdown', stop, {passive: true});
    doc.addEventListener('keydown', stop);
    win.addEventListener('blur', stop);
    reduced.addEventListener('change', stop);
    return {
        update(active: boolean, scope: Document | HTMLElement = doc) {
            // DOM probes can refresh unchanged settings while React mounts rows.
            // They must not discard the remainder of an accepted wheel event.
            if (active === enabled && scope === wheelRoot) {
                return;
            }
            wheelRoot.removeEventListener('wheel', onWheel as EventListener);
            wheelRoot = scope;
            if (active) {
                wheelRoot.addEventListener('wheel', onWheel as EventListener, {passive: false});
            }
            enabled = active;
            stop();
        },
        dispose() {
            stop();
            wheelRoot.removeEventListener('wheel', onWheel as EventListener);
            doc.removeEventListener('pointerdown', stop);
            doc.removeEventListener('keydown', stop);
            win.removeEventListener('blur', stop);
            reduced.removeEventListener('change', stop);
        },
    };
}
