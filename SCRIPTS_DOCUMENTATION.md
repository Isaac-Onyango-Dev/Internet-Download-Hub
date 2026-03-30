# Package.json Scripts Documentation

This document explains the purpose and functionality of each script in `package.json`.

## Development Scripts

### `postinstall`
- **Purpose**: Installs Playwright browser for web scraping functionality
- **When**: Runs automatically after `npm install`
- **Command**: `npx playwright install chromium`

### `generate:icons`
- **Purpose**: Generates application icons in various sizes from source image
- **Used for**: Windows .ico, macOS .icns, and Linux .png files
- **Command**: `tsx scripts/generate-icons.ts`

### `dev:main`
- **Purpose**: Builds only the main Electron process (TypeScript to CommonJS)
- **Used for**: Faster iteration during development
- **Command**: `npx esbuild electron/main.ts --bundle --platform=node --format=cjs --outfile=electron/main.cjs --external:electron --external:electron-log --external:electron-updater --external:sql.js --external:playwright-core`

### `dev`
- **Purpose**: Full development environment with hot reload
- **Steps**:
  1. Kills existing processes on ports 5173 and 5005
  2. Builds preload script
  3. Starts Vite dev server for React frontend
  4. Builds and launches Electron main process
  5. Waits for Vite to be ready before starting Electron
- **Command**: `npx kill-port 5173 5005 && npx esbuild electron/preload.ts --bundle --platform=node --outfile=electron/preload.cjs --external:electron && concurrently --kill-others-on-fail "vite" "npm run dev:main && wait-on http://localhost:5173 && tsx scripts/dev-electron.ts"`

## Build Scripts

### `build`
- **Purpose**: Full production build pipeline
- **Steps**:
  1. Builds React frontend with Vite
  2. Builds Electron processes
  3. Runs electron-builder for packaging
- **Command**: `tsx scripts/build.ts && electron-builder build`

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

### `prebuild:win`
- **Purpose**: Pre-build setup for Windows production builds
- **Steps**:
  1. Builds Vite frontend
  2. Builds Electron processes with production defines
  3. Handles import.meta.url for CommonJS compatibility
- **Command**: `vite build && npx esbuild electron/main.ts --bundle --platform=node --format=cjs --define:import.meta.url=undefined --outfile=electron/main.cjs --external:electron --external:electron-log --external:sql.js --external:playwright-core && npx esbuild electron/preload.ts --bundle --platform=node --define:import.meta.url=undefined --outfile=electron/preload.cjs --external:electron`

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

## Utilities

### `check`
- **Purpose**: TypeScript type checking without compilation
- **Function**: Verifies type correctness across the codebase
- **Command**: `tsc`

## Usage Examples

### Development
```bash
# Start development server with hot reload
npm run dev

# Build only main process (faster iteration)
npm run dev:main
```

### Production Build
```bash
# Build for current platform
npm run build

# Build for specific platforms
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
```
