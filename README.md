<p align="center">
  <img src="docs/images/cover.png" alt="Mattermost Fluent — Work feels a little lighter" width="100%">
</p>

<p align="center">
  <a href="https://github.com/Shightrox/mattermost-fluent/releases/tag/v6.3.0-fluent.32"><img src="https://img.shields.io/badge/preview-32-a9d8db?style=flat-square&labelColor=202b33" alt="Preview 32"></a>
  <img src="https://img.shields.io/badge/Windows-x64-c4b5fd?style=flat-square&labelColor=202b33" alt="Windows x64">
  <a href="LICENSE.txt"><img src="https://img.shields.io/badge/license-Apache--2.0-bfcbd3?style=flat-square&labelColor=202b33" alt="Apache 2.0 license"></a>
</p>

<p align="center">
  <strong>A Fluent-inspired Mattermost client for Windows.</strong><br>
  Glass surfaces, calmer conversations, and colors that stay on your device.
</p>

<p align="center">
  <a href="https://github.com/Shightrox/mattermost-fluent/releases/download/v6.3.0-fluent.32/mattermost-fluent-6.3.0-fluent.32-windows-x64-setup.exe"><img src="docs/images/download-setup.svg" width="224" height="52" alt="Download Windows installer"></a>
  &nbsp;
  <a href="https://github.com/Shightrox/mattermost-fluent/releases/download/v6.3.0-fluent.32/mattermost-fluent-6.3.0-fluent.32-win-x64.zip"><img src="docs/images/download-zip.svg" width="184" height="52" alt="Download Windows ZIP"></a>
</p>

<p align="center">
  <a href="https://github.com/Shightrox/mattermost-fluent/releases/tag/v6.3.0-fluent.32">Release notes &amp; checksums</a> · <a href="#your-workspace-your-colors">Explore the themes</a> · <a href="docs/ROADMAP.md">Roadmap</a><br>
  <sub>Unsigned community preview · Windows x64 · Not an official Mattermost product</sub>
</p>

## Familiar work. Softer surroundings.

Your existing Mattermost server, with a local presentation layer. Mica, Acrylic or solid surfaces; a quieter sidebar and room for the conversation. No server-side theme installation required.

![Real Windows screenshot of the Fluent demo, with a website visible behind and through its acrylic window](docs/images/acrylic-desktop.png)

<p align="center"><sub>Real Windows capture · Fictional demo workspace · The website behind the window is intentionally visible to show Acrylic transparency.</sub></p>

## Keep the context close

Message bubbles, attachment galleries and reactions, with threads beside the conversation. Dedicated navigation keeps conversations, saved messages and drafts within reach.

![A contextual thread alongside the main conversation in Plum and Rose](docs/images/showcase-thread.png)

## Your workspace, your colors

**Six window tints. Eight independent accents.** Light or dark, with adjustable chat background density. Choose a mood and keep it local.

![Ocean and Iris, Sand and Indigo, Plum and Rose: three example appearances](docs/images/theme-gallery.png)

<p align="center">
  <a href="docs/images/showcase-dark.png">Ocean / Iris</a> &nbsp; · &nbsp; <a href="docs/images/showcase-light.png">Sand / Indigo</a> &nbsp; · &nbsp; <a href="docs/images/showcase-thread.png">Plum / Rose</a> &nbsp; · &nbsp; <a href="docs/images/palettes.png">All tint and accent families</a>
</p>

## A little light, right where you are

Highlights follow the cursor. Soft ripples start where you click. Effects stop at rest and respect reduced motion and the **Smooth motion** setting.

<p align="center">
  <img src="docs/images/liquid.gif" width="640" alt="Client glow and click ripple demonstrated on two isolated sample controls">
</p>

<p align="center"><sub>Actual client effect on isolated demonstration controls. The GIF is not a frame-rate benchmark.</sub></p>

---

All chat content uses **fictional people and messages**. The Acrylic scene above is a real desktop screenshot; the other showcase compositions use production renderer captures with an emulated backdrop. [How the showcase was made](docs/SHOWCASE.md).

<details>
<summary><strong>Installation &amp; preview limitations</strong></summary>

Download the setup executable for guided installation, or extract the entire ZIP and run **Mattermost Fluent.exe**. Both use `%APPDATA%/Mattermost Fluent`; the ZIP does not carry a separate portable profile. Quit Fluent before replacing its files.

- Preview **32**, based on Mattermost Desktop 6.3. Native Mica/Acrylic requires Windows 11 22H2 or later and suitable system settings; solid surfaces provide a fallback.
- Builds are unsigned, so Windows may display an unknown-publisher or SmartScreen warning.
- History-loading stalls remain. No universal performance improvement is claimed.
- The adapter depends on server web-app markup; compatibility across all server versions and plugins is not yet verified.
- macOS and Linux are inherited from upstream but are not validated Fluent targets.
- Upstream binary updates are disabled. Install preview updates manually.

[Release notes](https://github.com/Shightrox/mattermost-fluent/releases/tag/v6.3.0-fluent.32) · [Validation](docs/VALIDATION.md) · [Release roadmap](docs/ROADMAP.md)

</details>

<details>
<summary><strong>Build &amp; contribute</strong></summary>

Use the Node.js version in `.nvmrc`. On Windows x64, `npm run setup:windows` prepares verified native dependencies without the optional Visual Studio ATL component. With normal native build tools installed:

```sh
npm ci
npm run build-prod
npm start
```

`npm run package:fluent` creates the installer and ZIP. Use `npm run watch` for development, `npm run check` for code checks and `npm run test:fluent` for the synthetic UI fixture.

Localhost fixtures and generated sessions belong in ignored `artifacts/`. Never reuse fixture credentials for a real service.

[Contribution guide](CONTRIBUTING.md) · [Report an issue](https://github.com/Shightrox/mattermost-fluent/issues/new/choose) · [Security reporting](SECURITY.md)

</details>

<details>
<summary><strong>Credits &amp; license</strong></summary>

Based on [Mattermost Desktop](https://github.com/mattermost/desktop), originally created as electron-mattermost by Yuya Ochiai. Inspired by Fluent design and the restrained visual direction of Fluenty for Steam. This fork is not an official Mattermost or Microsoft product.

[Apache 2.0 license](LICENSE.txt) · [Notices](NOTICE.txt) · [Fluent icon notices](NOTICE-Fluent-Icons.txt) · [Source provenance](CONTRIBUTING.md#source-provenance)

</details>
