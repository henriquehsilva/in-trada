# AGENTS.md — IN-TRADA

## Quick commands

- `npm run dev` — Vite dev server (uses `--debug` flag)
- `npm run build` — Production build (`vite build`)
- `npm run lint` — ESLint (`eslint .`)
- No typecheck, format, or test commands exist. There is no test runner configured.
- Seed emulator data: `npx ts-node scripts/seed.ts` (requires Firestore emulator on 8080)

## Architecture

Single-package React 18 + TypeScript + Vite SPA with Tailwind CSS. No monorepo.

- **Firebase**: Auth, Firestore (with persistent cache), Storage. Config in `src/firebase/config.ts`.
- **Firebase Emulators**: Enable with `VITE_USE_EMULATORS=1`. Ports: Firestore 8080, Auth 9099, Storage 9199, Functions 5001. UI on 4000.
- **Netlify Functions**: `netlify/functions/qz-sign.js` — RSA-SHA512 signing for QZ Tray. Requires `QZ_PRIVATE_KEY_B64` env var in Netlify.
- **Deployment**: Firebase Hosting or Netlify (both configured). Netlify build: `npm run build`, publish `dist/`.

## QZ Tray integration

All QZ Tray logic lives in `src/pages/recepcionista/PainelRecepcao.tsx` and `src/utils/qzPrintUtils.ts`.

- Certificate: `public/qz/digital-certificate.txt` (public key from qz.io/login)
- Signing URL: `VITE_QZ_SIGN_URL` env var (defaults to `/.netlify/functions/qz-sign`)
- Connection has a 15s timeout (QZ Tray promise can hang forever if user ignores the "Action Required" dialog)
- Printing paths:
  - **Rotated labels** (`imprimirRodado` flag): Canvas-based rendering + 90deg CW rotation → sent as `image/png` base64 to QZ
  - **Normal labels**: Raw HTML sent as `type: 'pixel', format: 'html'`
  - **Fallback** (no QZ Tray): Opens a new browser window with `window.print()`
- Brother printers require `imprimirRodado: true` on the `ModeloCracha` — the canvas rotation approach is used because QZ Tray's HTML motor doesn't handle CSS `transform: rotate()` reliably.

## Badge editor

Drag-and-drop editor in `src/components/editor/`. Badge models stored as `ModeloCracha` in Firestore with `componentes: ComponenteEditor[]`. Custom fonts stored in localStorage under key `editorCrachas.customFonts` as data URLs, injected as `@font-face` in print HTML.

## Key conventions

- **Language**: All UI strings are in Brazilian Portuguese. Preserve this.
- **Categories**: Always normalized to uppercase via `normalizeCategory()`. Firestore queries filter by uppercase.
- **Field names**: `Participante` has 10 generic fields (`opcao1`..`opcao10`) with customizable labels per event (`labelsOpcoes` in `Evento`).
- **`codigoCliente`**: Used as QR Code value and barcode value. Auto-assigned as the Firestore document ID on creation.
- **Node polyfills**: Required for crypto/stream in browser (`vite-plugin-node-polyfills` + `crypto-browserify` alias in `vite.config.ts`).
- **Firestore/Storage rules**: Both wide-open (`allow read, write: if true`) — development only. Do not deploy to production without fixing.

## Gotchas

- No `format` or `typecheck` script. `npm run lint` is the only automated check.
- `react-beautiful-dnd` is used for drag-and-drop (not maintained, but works with React 18).
- QZ Tray signing requires the private key base64-encoded as `QZ_PRIVATE_KEY_B64` in Netlify env. Without it, printing silently fails.
- The `@page` CSS in print HTML sets exact pixel dimensions matching the badge size — changing badge `larguraCm`/`alturaCm` affects both display and print.
- `firestore.indexes.json` is referenced in `firebase.json` but doesn't exist in the repo — Firebase will error if you try to deploy indexes.
- TypeScript uses `tsconfig.app.json` + `tsconfig.node.json` (no root `tsconfig.json`). IDE should pick them up automatically.
- `.env` contains live Firebase config and is gitignored. Never commit it.
