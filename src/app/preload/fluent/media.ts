// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function createFluentMedia() {
    const galleries = new Set<HTMLElement>();
    const refresh = (gallery: HTMLElement) => {
        const tiles = gallery.querySelectorAll<HTMLElement>('.MediaGallery__tile');
        gallery.toggleAttribute('data-fluent-gallery', tiles.length > 1);
        tiles.forEach((tile, index) => tile.toggleAttribute('data-fluent-gallery-wide', tiles.length > 1 && tiles.length % 2 === 1 && index === tiles.length - 1));
        galleries.add(gallery);
    };
    return {
        scan(node: Element) {
            galleries.forEach((gallery) => {
                if (!gallery.isConnected) {
                    galleries.delete(gallery);
                }
            });
            const ancestor = node.closest<HTMLElement>('.MediaGallery');
            if (ancestor) {
                refresh(ancestor);
            } else {
                node.querySelectorAll<HTMLElement>('.MediaGallery').forEach(refresh);
            }
        },
        dispose() {
            galleries.forEach((gallery) => {
                gallery.removeAttribute('data-fluent-gallery');
                gallery.querySelectorAll('[data-fluent-gallery-wide]').forEach((tile) => tile.removeAttribute('data-fluent-gallery-wide'));
            });
            galleries.clear();
        },
    };
}
