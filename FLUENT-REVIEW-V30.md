# Preview 30 — independent window tint and expanded accents

Appearance now offers six window tints (neutral, graphite, ocean, forest, plum,
sand) and eight accents (sky, iris, sage, teal, rose, amber, coral, indigo).
Tint colors the shell, navigation and conversation canvas beneath native glass;
the existing chat density control still controls transparency. Solid mode also
uses the tint. Each palette has distinct light/dark values. Neutral preserves
the previous appearance. Collections support all eight accents.

Configuration is device-local, validated and defaults old profiles to neutral.
Remote and internal renderers receive live changes. Disabling Fluent removes the
tint attribute. The patch adds no animation, filter, layer or wheel handler.

Validation: configuration defaults and rejected invalid values; full type/lint
and unit checks; Chromium independent tint/accent and opt-out checks; production
settings renderer keyboard selection, saved configuration reload, palette bounds
at 700/1200 pixels and visual inspection in both themes. Synthetic data only.
