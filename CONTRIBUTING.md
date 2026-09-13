# Contributing to Mattermost Fluent

File Fluent-specific bugs and ideas in this repository. Include reproducible steps, your Windows and server versions, and the selected theme/material. Use fictional or redacted screenshots; never share server credentials, session files or private messages.

This is a client-side fork. Changes must preserve stock server APIs, authentication, permissions and message behavior. Avoid per-message blur, continuous idle animation loops and custom wheel handling on the virtualized conversation feed.

Use Node from .nvmrc. On Windows x64, npm run setup:windows prepares dependencies using verified upstream native binaries. Then run npm run build-prod and npm start. The regular native build path is npm ci with the required Windows build tools installed.

Before submitting changes, run npm run check and relevant Fluent integration checks. UI changes should cover light/dark themes, keyboard access, reduced motion and narrow windows. Integration fixtures must use localhost and synthetic accounts.

Keep existing copyright headers and notices. See LICENSE.txt and NOTICE.txt. Upstream contribution guidance: https://developers.mattermost.com/contribute/desktop/.

## Source provenance

This repository starts from a source snapshot of the client-side Fluent fork, based on [Mattermost Desktop](https://github.com/mattermost/desktop), 6.3 code line. The earliest upstream commit available in the development checkout is `274602892a4391ac8c455cc09bdb52632ab282a9`; the public snapshot was prepared from local Fluent commit `e9da6c9` with publication-specific documentation and workflows.

Original copyright headers, licenses and attribution notices remain intact. Local development commit metadata, runtime profiles, sessions, logs, build artifacts and working-server data are excluded. Showcase conversations use fictional data; see [artwork provenance](docs/SHOWCASE.md).

Upstream organization-specific release, signing and scheduled workflows are replaced by a Windows source check/build workflow. This fork does not publish upstream binaries or claim an official Mattermost release.
