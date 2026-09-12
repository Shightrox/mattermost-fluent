# Contributing to Mattermost Fluent

File Fluent-specific bugs and ideas in this repository. Include reproducible steps, your Windows and server versions, and the selected theme/material. Use fictional or redacted screenshots; never share server credentials, session files or private messages.

This is a client-side fork. Changes must preserve stock server APIs, authentication, permissions and message behavior. Avoid per-message blur, continuous idle animation loops and custom wheel handling on the virtualized conversation feed.

Use Node from .nvmrc. On Windows x64, npm run setup:windows prepares dependencies using verified upstream native binaries. Then run npm run build-prod and npm start. The regular native build path is npm ci with the required Windows build tools installed.

Before submitting changes, run npm run check and relevant Fluent integration checks. UI changes should cover light/dark themes, keyboard access, reduced motion and narrow windows. Integration fixtures must use localhost and synthetic accounts.

Keep existing copyright headers and notices. See LICENSE.txt and NOTICE.txt. Upstream contribution guidance: https://developers.mattermost.com/contribute/desktop/.
