# Package.json Scripts Documentation

This document explains the purpose and functionality of each script in `package.json`.

## Development Scripts

### `generate:icons`

- **Purpose**: Generates application icons in various sizes from source image
- **Used for**: Windows .ico, macOS .icns, and Linux .png files
- **Command**: `tsx scripts/generate-icons.ts`

### `dev:main`

- **Purpose**: Builds only the main Electron process (TypeScript to CommonJS)
- **Used for**: Faster iteration during development
- **Command**: `npx esbuild electron/main.ts --bundle --platform=node --format=cjs --outfile=electron/main.cjs --external:electron --external:electron-log --external:sql.js --external:playwright-core`

### `dev`

- **Purpose**: Full development environment with hot reload
- **Steps**:
  1. Kills existing processes on ports 5173 and 5005
  2. Builds preload script
  3. Starts Vite dev server for React frontend
  4. Builds and launches Electron main process
  5. Waits for Vite to be ready before starting Electron
- **Command**: `npx kill-port 5173 5005 && npx esbuild electron/preload.ts --bundle --platform=node --outfile=electron/preload.cjs --external:electron && concurrently --kill-others-on-fail "vite" "npm run dev:main && wait-on http://localhost:5173 && tsx scripts/dev-electron.ts"`

### `dev:web`

- **Purpose**: Development environment for the browser-based web version (not Electron)
- **Steps**: Runs Vite (frontend) and the Express server (`server/index.ts`) concurrently
- **Command**: `concurrently "cross-env VITE_TARGET=web vite" "tsx watch server/index.ts"`

### `setup:playwright`

- **Purpose**: Installs the Playwright Chromium browser used by the Playwright fallback extraction engine (`electron/extractor.ts`)
- **When**: Run manually as needed — not wired to `postinstall`, so it does not run automatically after `npm install`
- **Command**: `npx playwright-core install chromium`
- **Note**: `playwright-core` is declared in `optionalDependencies` and is excluded from the packaged installer, so this engine is available in development only

### `test`

- **Purpose**: Runs the Vitest test suite
- **Command**: `vitest run`

## Build Scripts

### `setup:binaries`

- **Purpose**: Downloads required binary tools (yt-dlp, ffmpeg, etc.)
- **Source**: Downloads from official GitHub releases
- **Command**: `tsx scripts/download-binaries.ts`

### `setup:binaries:force`

- **Purpose**: Force re-download of all binary tools
- **Behavior**: Ignores existing files and downloads fresh copies
- **Command**: `tsx scripts/download-binaries.ts --force`

### `build:electron`

- **Purpose**: Builds Electron processes (main and preload) for production
- **Process**: Converts TypeScript to CommonJS with bundling and minification
- **Command**: `npx esbuild electron/main.ts --bundle --platform=node --format=cjs --outfile=electron/main.cjs --external:electron --external:electron-log --external:sql.js --external:playwright-core && npx esbuild electron/preload.ts --bundle --platform=node --outfile=electron/preload.cjs --external:electron`

### `build:win`

- **Purpose**: Complete Windows build pipeline
- **Steps**:
  1. Downloads required binaries
  2. Generates application icons
  3. Builds React frontend
  4. Builds Electron processes
  5. Creates Windows installer with electron-builder
- **Command**: `npm run setup:binaries && npm run generate:icons && vite build && npm run build:electron && electron-builder build --win`

### `build:mac`

- **Purpose**: Complete macOS build pipeline
- **Result**: Creates .dmg installer for macOS
- **Command**: `npm run setup:binaries && npm run generate:icons && vite build && npm run build:electron && electron-builder build --mac`

### `build:linux`

- **Purpose**: Complete Linux build pipeline
- **Result**: Creates .AppImage for Linux
- **Command**: `npm run setup:binaries && npm run generate:icons && vite build && npm run build:electron && electron-builder build --linux`

### `build:web`

- **Purpose**: Builds the browser-based web version for deployment (used for the Render deployment)
- **Steps**: Builds the Vite frontend targeting web mode, then bundles `server/index.ts` (the Express backend) as an ESM module
- **Command**: `cross-env VITE_TARGET=web vite build && esbuild server/index.ts --bundle --platform=node --format=esm --outfile=dist/server.js --external:express`

### `start:web`

- **Purpose**: Starts the built web server in production mode (what Render runs)
- **Command**: `cross-env NODE_ENV=production node dist/server.js`

## Utilities

### `check`

- **Purpose**: TypeScript type checking without compilation
- **Function**: Verifies type correctness across the codebase
- **Command**: `tsc`

### `lint`

- **Purpose**: Runs ESLint across the client and Electron source
- **Command**: `eslint "client/src/**/*.{ts,tsx}" "electron/**/*.ts"`

### `format`

- **Purpose**: Formats the codebase with Prettier
- **Command**: `prettier --write "**/*.{ts,tsx,css,md}"`

## Usage Examples

### Development

```bash
# Start development server with hot reload
npm run dev

# Build only main process (faster iteration)
npm run dev:main

# Run the web version (frontend + Express server) locally
npm run dev:web
```

### Production Build

```bash
# Build for a specific platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

### Setup

```bash
# Download required binaries
npm run setup:binaries

# Force re-download binaries
npm run setup:binaries:force

# Generate app icons
npm run generate:icons
```

### Quality Check

```bash
# Type checking
npm run check

# Lint
npm run lint

# Format with Prettier
npm run format

# Run tests
npm run test
```
