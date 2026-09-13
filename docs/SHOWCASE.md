# Public showcase artwork

The images contain only fictional **Northstar Studio**, with Alex Kim, Maya Chen
and Jordan Lee. Messages and the abstract landscape attachment were generated
for the demo. No work-server screenshots, URLs, profiles, cookies or tokens are
included.

## Capture and composition

- Production preview.31 internal/external renderers and a localhost Mattermost
  11.10 web app, using a separate `fluent-public-showcase` Electron profile.
- The IPC fixture supplies fictional workspace/tab metadata. Sandbox is a
  presentation placeholder, not a second connected service.
- Native Windows captures were inspected, but their scaled output introduced
  text artifacts. Final artwork uses the renderers' native-resolution PNGs.
- Shell and server-view layers are composed at their original relative offsets
  over a controlled gradient. The backdrop and window-control glyphs are
  presentation elements: these are **emulated-glass compositions**, not native
  Acrylic screenshots or evidence of a particular GPU/OS result.
- Dark: Ocean + Iris, 75% chat density. Thread: Plum + Rose, 85%.
  Light: Sand + Indigo, solid material. Infographic tint swatches illustrate
  color families; actual values differ between light and dark themes.
- The lab mail-configuration banner was dismissed; synthetic setup notices
  were removed from the demo channel. Product controls were not replaced with
  painted mockups.

## Reproduce

1. Run `npm run build-prod`.
2. Start the lab from `scripts/fixtures/fluent-lab.compose.yml` and seed it with
   `scripts/seed-fluent-lab.cjs` if needed.
3. Run `node scripts/seed-fluent-showcase.cjs`. It accepts only
   `http://localhost:18065` and writes its session under ignored `artifacts/`.
4. Create `artifacts/showcase-control.json`, then run
   `node scripts/capture-fluent-showcase.cjs`. The server view blocks external
   hosts and uses only the generated demo session.
5. Select scenes through the control file, for example:

```json
{"theme":"dark","tint":"ocean","accent":"violet","opacity":75,"material":"acrylic","export":true}
```

Add `"thread":true` for the thread panel. Exports write `showcase-web.png` and
`showcase-window.png` under `artifacts/`. Save each pair as
`showcase-dark-web.png` / `showcase-dark-shell.png`, and the corresponding
`light` and `thread` filenames. Run `node scripts/render-fluent-showcase.cjs`.

Send `{"close":true}` through the control file to close the stage. Stop the lab
containers afterward. Never substitute a real workspace or publish generated
profile/session files.

## Assets

| File | Purpose |
| --- | --- |
| `images/hero.png` | Dark conversation cover |
| `images/palettes.png` | Light conversation and 6 × 8 palette infographic |
| `images/threads.png` | Contextual thread showcase |
| `images/showcase-dark.png`, `images/showcase-light.png`, `images/showcase-thread.png` | Standalone interface compositions |

Captions are English for the public repository. No performance guarantees are
encoded in the artwork.

## Repository presentation

`cover.png` and `social-preview.png` frame the existing synthetic dark capture
in a 1280 × 640 layout. `theme-gallery.png` places the three existing appearances
side by side. Cropping and rotation are presentation choices, not new UI states.

`liquid.gif` records the real `createFluentLiquid` implementation and its CSS
on two isolated demonstration buttons. It uses scripted pointer movement and
clicks, a visible cursor marker, and GIF encoding; its playback is not evidence
of application frame rate. It does not use a connected workspace.

To regenerate these assets, install the artwork-only encoder with
`npm install --prefix artifacts/visual-tools gifenc@1.0.3` and run
`node scripts/render-repository-art.cjs` after the original showcase captures
have been generated. The encoder is not an application dependency.

## Real desktop Acrylic capture

`images/acrylic-desktop.png` is a user-supplied, real Windows screenshot of the
isolated Northstar Studio demo. It replaces the earlier AI illustration.
The original image is preserved without cropping, retouching or regeneration.

The website behind the demo window is intentionally retained, including its
surrounding interface, so the source of the colors showing through the native
Acrylic material is visible. The chat contains only the fictional demo accounts
and messages. This image is distinct from the emulated backdrop compositions
described above; material appearance varies with Windows and application settings.
