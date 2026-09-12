// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Broad sibling rules in the webapp invalidate thousands of unrelated message
// descendants when the virtualizer inserts placeholders. Preserve their exact
// element-sibling semantics and specificity using narrowly owned DOM markers.
export function createFluentSpacing(doc: Document) {
    const spaced = 'data-mm-fluent-spaced';
    const afterDiv = 'data-mm-fluent-after-div';
    const rules = new Map<CSSStyleRule, {original: string; replacement: string}>();
    const parents = new Set<string>();
    const marked = new Set<Element>();
    const relevant = new Set<Element>();
    let enabled = false;
    let selector = '';
    const mark = (element: Element, attribute: string, active: boolean) => {
        element.toggleAttribute(attribute, active);
        if (active) {
            marked.add(element);
        } else if (!element.hasAttribute(spaced) && !element.hasAttribute(afterDiv)) {
            marked.delete(element);
        }
    };
    const refresh = (parent: Element) => {
        const direct = Boolean(selector && parent.matches(selector));
        const panel = Boolean(parent.closest('.PanelHeader__right'));
        if (!direct && !panel && !relevant.has(parent)) {
            return;
        }
        if (direct || panel) {
            relevant.add(parent);
        } else {
            relevant.delete(parent);
        }
        for (const child of parent.children) {
            mark(child, spaced, direct && Boolean(child.previousElementSibling));
            mark(child, afterDiv, panel && child.tagName === 'DIV' && child.previousElementSibling?.tagName === 'DIV');
        }
    };
    const scan = (node: Element) => {
        refresh(node);
        if (selector) {
            node.querySelectorAll(selector).forEach(refresh);
        }
        if (node.matches('.PanelHeader__right') || node.closest('.PanelHeader__right')) {
            node.querySelectorAll('*').forEach(refresh);
        } else {
            node.querySelectorAll('.PanelHeader__right').forEach((panel) => {
                refresh(panel);
                panel.querySelectorAll('*').forEach(refresh);
            });
        }
    };
    const visit = (list: CSSRuleList) => {
        for (const rule of list) {
            if (rule instanceof CSSStyleRule && !rules.has(rule)) {
                const original = rule.selectorText;
                let replacement = '';
                const simple = original.match(/^(\.[a-zA-Z_][\w-]*) > \* \+ \*$/);
                if (simple) {
                    parents.add(simple[1]);
                    replacement = `${simple[1]} > :where([${spaced}])`;
                } else if (original === '.PanelHeader__right div + div') {
                    replacement = `.PanelHeader__right div:where([${afterDiv}]):is(div)`;
                }
                if (replacement) {
                    rule.selectorText = replacement;
                    rules.set(rule, {original, replacement});
                }
            } else if ('cssRules' in rule) {
                visit((rule as CSSGroupingRule).cssRules);
            }
        }
    };
    const discover = () => {
        if (!enabled) {
            return;
        }
        const previous = rules.size;
        for (const sheet of doc.styleSheets) {
            try {
                visit(sheet.cssRules);
            } catch {
                // Cross-origin/protected stylesheets retain native behavior.
            }
        }
        selector = Array.from(parents).join(',');
        if (rules.size !== previous) {
            scan(doc.documentElement);
        }
    };
    const observer = new MutationObserver((records) => {
        const added = new Set<Element>();
        let stylesChanged = false;
        let removed = false;
        for (const record of records) {
            const target = record.target instanceof Element ? record.target : record.target.parentElement;
            if (target?.closest('[data-fluent-liquid]')) {
                continue;
            }
            removed ||= record.removedNodes.length > 0;
            if (target?.closest('style')) {
                stylesChanged = true;
                continue;
            }
            if (target) {
                refresh(target);
                if (record.type === 'attributes' && target.matches('.PanelHeader__right')) {
                    scan(target);
                }
            }
            for (const node of record.addedNodes) {
                if (node instanceof Element) {
                    stylesChanged ||= node.matches('style, link[rel="stylesheet"]') || Boolean(node.querySelector('style, link[rel="stylesheet"]'));
                    added.add(node);
                }
            }
        }
        if (stylesChanged) {
            discover();
        }
        for (const node of added) {
            let parent = node.parentElement;
            while (parent && !added.has(parent)) {
                parent = parent.parentElement;
            }
            if (node.isConnected && !parent && !node.matches('[data-fluent-liquid]')) {
                scan(node);
            }
        }
        if (removed) {
            for (const node of marked) {
                if (!node.isConnected) {
                    node.removeAttribute(spaced);
                    node.removeAttribute(afterDiv);
                    marked.delete(node);
                }
            }
            for (const node of relevant) {
                if (!node.isConnected) {
                    relevant.delete(node);
                }
            }
        }
    });
    const onLoad = (event: Event) => {
        if (event.target instanceof HTMLLinkElement && event.target.rel === 'stylesheet') {
            discover();
        }
    };
    const dispose = () => {
        enabled = false;
        observer.disconnect();
        doc.removeEventListener('load', onLoad, true);
        for (const [rule, {original, replacement}] of rules) {
            if (rule.selectorText === replacement) {
                rule.selectorText = original;
            }
        }
        rules.clear();
        parents.clear();
        selector = '';
        for (const node of marked) {
            node.removeAttribute(spaced);
            node.removeAttribute(afterDiv);
        }
        marked.clear();
        relevant.clear();
    };
    return {
        update(active: boolean) {
            if (!active) {
                dispose();
                return;
            }
            if (!enabled) {
                enabled = true;
                observer.observe(doc.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
                doc.addEventListener('load', onLoad, true);
                discover();
            }
        },
        dispose,
    };
}
