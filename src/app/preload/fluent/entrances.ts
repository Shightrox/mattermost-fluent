// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Animate only freshly created posts, never virtualization/remounts of history.
// Current core markup exposes the creation epoch on the permalink's label ID.
// Unknown timestamps deliberately receive no entrance effect.
export function createFluentEntrances(win: Window) {
    const seen = new Set<string>();
    const animations = new Set<Animation>();
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    let route = '';
    let entered = Date.now();
    const stop = () => {
        animations.forEach((animation) => animation.cancel());
        animations.clear();
    };
    reduced.addEventListener('change', stop);
    return {
        scan(node: Element, enabled: boolean) {
            if (!enabled || reduced.matches) {
                stop();
                entered = Date.now();
                return;
            }
            if (route !== win.location.pathname) {
                route = win.location.pathname;
                entered = Date.now();
                seen.clear();
                stop();
            }
            const selector = '[data-testid="postView"]';
            const posts = node.matches(selector) ? [node] : node.querySelectorAll(selector);
            for (const post of posts) {
                const link = post.querySelector<HTMLElement>('.post__permalink');
                const id = link?.getAttribute('href');
                if (!id || seen.has(id)) {
                    continue;
                }
                seen.add(id);
                if (seen.size > 2048) {
                    seen.delete(seen.values().next().value!);
                }
                const stamp = link?.getAttribute('aria-labelledby') ?? '';
                const created = (/^\d{13}$/).test(stamp) ? Number(stamp) : 0;
                const now = Date.now();
                if (created <= entered || now - entered < 800 || now - created > 10000 || created > now + 1000 || post.classList.contains('post--system')) {
                    continue;
                }
                const bubble = post.querySelector<HTMLElement>('.post__content');
                const animation = bubble?.animate([{opacity: 0.4}, {opacity: 1}], {duration: 180, easing: 'ease-out'});
                if (animation) {
                    animations.add(animation);
                    animation.onfinish = () => animations.delete(animation);
                    animation.oncancel = () => animations.delete(animation);
                }
            }
        },
        dispose() {
            stop();
            seen.clear();
            entered = Date.now();
            route = '';
        },
        destroy() {
            stop();
            reduced.removeEventListener('change', stop);
        },
    };
}
