# Contributing to Internet Download Hub

Thank you for your interest in contributing to Internet Download Hub! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Getting Started

1. **Fork the repository** — Click the "Fork" button on the GitHub page to create your own copy
2. **Clone your fork** — Replace `yourusername` with your GitHub username:

```cmd
git clone https://github.com/yourusername/Internet-Download-Hub.git
cd Internet-Download-Hub
```

3. **Add the upstream remote** — This lets you sync with the original repository:

```cmd
git remote add upstream https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub.git
```

## Development Setup

### Prerequisites

- **Node.js 18+** — Download from [nodejs.org](https://nodejs.org/)
- **npm 9+** — Comes with Node.js
- **Windows 10/11** — The app is designed for Windows

### Install Dependencies

```cmd
npm install
```

This will install all required packages including:

- Electron and related dependencies
- React and TypeScript
- Tailwind CSS and build tools
- Development utilities

### Run in Development Mode

```cmd
npm run dev
```

This will:

1. Start the Vite dev server on port 5173
2. Build the Electron main process
3. Launch the Electron app with hot reloading

### Build for Production

To build the Windows installer:

```cmd
npm run build:win
```

The installer will be created in the `release/` folder.

### Type Checking

Before submitting changes, run:

```cmd
npm run check
```

This runs TypeScript type checking to ensure no type errors.

## Project Structure

```
Internet-Download-Hub/
├── electron/           # Electron main process
│   ├── main.ts         # Main entry point
│   ├── preload.ts      # Preload scripts (context bridge)
│   ├── extractor.ts    # Video extraction logic
│   ├── errors.ts       # Error handling and translation
│   └── ytdlp-args.ts  # yt-dlp argument builder
├── client/             # React frontend
│   ├── src/
│   │   ├── pages/      # Page components
│   │   ├── components/ # UI components
│   │   ├── hooks/      # React hooks
│   │   └── lib/        # Utility functions
│   └── index.html
├── assets/             # Icons and images
├── binaries/           # Bundled executables (yt-dlp, ffmpeg, etc.)
└── release/            # Built installers
```

## Coding Standards

### TypeScript

- Use **strict TypeScript** — Avoid `any` types when possible
- Define proper **interfaces** for all component props
- Use **import types** where appropriate
- Run `npm run check` to verify no type errors

### React Components

- Use **functional components** with hooks
- Follow the existing component patterns in `client/src/components/ui/`
- Use **Tailwind CSS classes** for styling
- Keep components **focused and small**

### Tailwind CSS

- Use **Tailwind's utility classes** for all styling
- Follow the color scheme defined in `tailwind.config.ts`
- Use **`cn()` utility** for conditional classes

### File Organization

- Components go in `client/src/components/`
- Page components go in `client/src/pages/`
- Custom hooks go in `client/src/hooks/`
- Utilities go in `client/src/lib/`

### Git Commit Messages

- Use **clear, descriptive commit messages**
- Start with a verb (Add, Fix, Update, Remove)
- Keep the first line under 72 characters
- Add body text for complex changes

Examples:

```
Add playlist detection feature
Fix binary update check failing on first launch
Update YouTube extractor for new age-gate handling
```

## Making Changes

1. **Create a feature branch** — Never commit directly to main:

```cmd
git checkout -b feature/my-new-feature
```

2. **Make your changes** — Write code, fix bugs, add features
3. **Test thoroughly** — Run the app and test your changes
4. **Run type checking** — `npm run check`
5. **Commit your changes** — Use clear commit messages

## Submitting Changes

1. **Push to your fork**:

```cmd
git push origin feature/my-new-feature
```

2. **Open a Pull Request** — Go to the original repository and click "New Pull Request"
3. **Fill out the PR template** — Provide a clear description of your changes
4. **Wait for review** — The maintainer will review your changes

### Pull Request Guidelines

- Reference any related issues using `#issue-number`
- Include screenshots for UI changes
- Ensure `npm run check` passes
- Keep PRs focused — one feature or fix per PR

## Reporting Issues

Before reporting an issue, please:

1. **Search existing issues** — Your bug or feature might already be reported
2. **Check the latest version** — Make sure you're running the newest release
3. **Provide detailed information** — Include OS version, app version, and exact steps to reproduce

Use the issue templates:

- [Bug Report](./.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature Request](./.github/ISSUE_TEMPLATE/feature_request.md)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Questions?

Feel free to:

- Open an issue for questions
- Check the [FAQ](./README.md#faq) in the README
- Review existing discussions

Thank you for contributing!
