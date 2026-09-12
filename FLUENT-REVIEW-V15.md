# Title bar drag region and sidebar category headers — v15

- The flexible FluentCommands container previously marked its entire width as no-drag. Only its buttons now exclude window dragging; empty space belongs to the drag region. Search, history, tools and native window controls keep their actions.
- The current webapp uses SidebarChannelGroupHeader, not the older SidebarCategoryHeader selectors. Added scoped styles for the actual markup: transparent header background, 12 px inset, consistent label typography and spacing. Existing category names, collapse controls, menus and drag handles remain owned by Mattermost.
- Production build, production shell checks and Fluent Chromium checks passed. Shell checks now assert the command container's computed drag region and button exclusions, alongside existing history and server-switch interactions. Physical OS window dragging was not automated by this offscreen harness.
- On the local Mattermost 11.10 webapp, verified transparent category backgrounds and collapse/expand behavior in light and dark acrylic themes. Reviewed the dark screenshot. No working account messages or category preferences were changed.

This is a targeted fix, not completion of the broader sidebar redesign or the release compatibility matrix.
