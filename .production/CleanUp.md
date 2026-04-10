Usage: Invoke this prompt at the end of every development session, feature branch, or release cycle — after all changes, upgrades, and tests have been completed and verified.

You are now entering the CLEANUP & PRODUCTION READINESS phase.

All development work, feature additions, bug fixes, and tests for this session are complete.
Your role now shifts entirely to cleanup, hardening, and production preparation.

The target is a codebase that a brand-new user can clone or install from scratch on a
fresh machine — with zero development artifacts, zero test pollution, zero exposed secrets,
and zero assumptions about the developer's environment.

Work through every phase below in strict order. Do not skip any phase.
Report a checklist summary at the end of each phase before proceeding to the next.

────────────────────────────────────────────────────────────
PHASE 1 — TEST FILE & TEST DATA REMOVAL
────────────────────────────────────────────────────────────

1.1 TEST FILES
    - Identify and list all files that exist solely for testing purposes:
      * *.test.ts / *.test.tsx / *.spec.ts / *.spec.tsx files not required at runtime
      * __tests__/ directories and their full contents
      * test/ or tests/ directories that are not part of the published output
      * Any fixture files, mock data files, or factory files used only in tests
      * Playwright or e2e test scripts (e2e/, playwright/, cypress/) in the source tree
    - For each: confirm it is not imported or required by any runtime code path.
    - Remove all confirmed test-only files.
    - NOTE: Do NOT remove test config files (jest.config, playwright.config, vitest.config)
      from the repo root — they are part of the development toolchain — but DO ensure they
      are excluded from the production build output.

1.2 HARDCODED TEST DATA
    - Scan all source files for:
      * Hardcoded URLs used for testing (e.g. "https://www.youtube.com/watch?v=test123",
        "https://example.com/video", localhost URLs, 127.0.0.1 URLs left in source logic)
      * Hardcoded test usernames, passwords, tokens, or API keys embedded in code
      * Hardcoded file paths that point to the developer's local machine
      * Hardcoded IPs, ports that only worked in the dev environment
      * Dummy/placeholder data arrays or objects used to mock a real feature during dev
    - Replace all hardcoded test URLs with the correct configurable constant, environment
      variable, or user-input-driven value.
    - If a value must exist as a placeholder (e.g. an API endpoint), move it to a config
      file or .env.example — never leave it inline in source logic.

1.3 SEED / FIXTURE DATA
    - Remove any database seed scripts, SQL dump files, or JSON fixture files that were
      used to populate development databases or in-memory stores.
    - If seeds are genuinely needed for first-run setup (e.g., default config), move them
      to a clearly labeled `setup/` or `resources/` directory and document their purpose.

────────────────────────────────────────────────────────────
PHASE 2 — DEAD CODE & GHOST FILE REMOVAL
────────────────────────────────────────────────────────────

2.1 UNUSED / ORPHANED FILES
    - Identify files that exist in the project but are never imported, required, or
      referenced anywhere in the codebase:
      * Unused components, hooks, utilities, helpers
      * Old versions of files (e.g. "ComponentV2.tsx", "utils_old.ts", "backup_main.js")
      * Scaffold or boilerplate files generated at project init and never modified or used
      * Leftover files from removed features or abandoned experiments
    - Confirm orphan status by checking all import paths and dynamic require() calls.
    - Remove confirmed orphan files.

2.2 COMMENTED-OUT CODE
    - Locate all blocks of code that have been commented out (not documentation comments).
    - Evaluate each block:
      * If it was replaced by better code → DELETE it entirely. Version control (Git)
        preserves history; commented-out code is noise, not a safety net.
      * If it represents a known TODO that must ship → Uncomment and implement it, or
        raise it as a tracked issue and remove the comment block.
    - Do NOT leave large commented-out code blocks in any source file.

2.3 GHOST IMPORTS & DEAD DEPENDENCIES
    - Scan all source files for imported symbols, modules, or packages that are never used.
    - Remove all unused import statements.
    - Cross-check package.json dependencies:
      * Move any package used only in tests or build scripts to devDependencies if it is
        currently in dependencies.
      * Flag (but do not blindly remove) any package in dependencies that appears unused —
        confirm it is not a peer dependency or runtime polyfill before removing.
    - Remove confirmed unused packages from dependencies.

2.4 CONSOLE LOGS & DEBUG STATEMENTS
    - Find and remove all:
      * console.log(), console.warn(), console.error() calls left from debugging
        (except intentional user-facing error logs that must remain)
      * debugger; statements
      * Development-only log utilities that were not wrapped in an environment guard
    - Any logging that MUST remain in production (e.g. error reporting, crash diagnostics)
      must be:
      * Wrapped in a proper logger utility (e.g. a logger that checks NODE_ENV/IS_DEV)
      * Never leaking sensitive data (file paths, tokens, internal state dumps)

────────────────────────────────────────────────────────────
PHASE 3 — SECRETS, ENVIRONMENT & CONFIGURATION HARDENING
────────────────────────────────────────────────────────────

3.1 SECRET SCANNING
    - Scan the entire codebase for secrets that must NEVER be committed or shipped:
      * API keys, OAuth tokens, client secrets
      * Private keys, certificates embedded in source
      * Database connection strings with credentials
      * Access tokens (GitHub, AWS, Google, etc.)
    - Any found secret must be:
      a) Immediately removed from source code
      b) Moved to a .env file (which is gitignored)
      c) Documented in .env.example with a descriptive placeholder value

3.2 .ENV FILE HYGIENE
    - Verify .env is listed in .gitignore — if not, add it NOW.
    - Verify .env.example exists and documents every required variable with:
      * The variable name
      * A description of what it does
      * A safe placeholder value (never a real secret)
    - Verify no .env file with real values is tracked by Git.
    - For Electron/desktop apps: confirm that sensitive config is read at runtime from
      the user's local environment or a user-config store (e.g. electron-store),
      NOT baked into the packaged binary.

3.3 DEVELOPMENT-ONLY FLAGS & DEVTOOLS
    - Locate all DevTools openings, debug windows, or verbose logging that should only
      run in development:
      * mainWindow.webContents.openDevTools() — must be guarded by isDev check
      * Any debug overlay, performance panel, or internal dashboard
      * Any route, endpoint, or UI element that exposes internals (e.g. /debug, /test-panel)
    - Ensure every dev-only block is properly guarded:
      * Use: if (process.env.NODE_ENV !== 'production') { ... }
      * Or:  if (isDev) { ... }  using a reliable dev-detection utility
    - These guards must be verifiable — test that they evaluate to false in a production build.

3.4 PRODUCTION vs DEVELOPMENT PATHS
    - Verify all file paths, resource paths, and binary paths resolve correctly on a
      fresh machine without the developer's local folder structure.
    - For Electron: confirm all paths use app.getPath(), __dirname with path.join(), or
      process.resourcesPath for bundled resources — not absolute paths from the dev machine.
    - Verify that bundled binaries (yt-dlp, gallery-dl, streamlink, N_m3u8DL-RE) are
      referenced via relative, runtime-resolved paths that will survive packaging.

────────────────────────────────────────────────────────────
PHASE 4 — BUILD ARTIFACT & REPOSITORY HYGIENE
────────────────────────────────────────────────────────────

4.1 BUILD OUTPUT DIRECTORIES
    - Confirm the following are listed in .gitignore (do not commit build output):
      * dist/, out/, build/, release/, .vite/, .cache/
      * node_modules/
      * *.asar files (Electron packaged output)
      * Any generated binary or installer file
    - Remove any build output that was accidentally committed to the repository.

4.2 TEMPORARY & OS-GENERATED FILES
    - Remove and gitignore:
      * .DS_Store (macOS metadata)
      * Thumbs.db (Windows thumbnail cache)
      * *.log files (npm-debug.log, yarn-error.log)
      * .npm/ cache directories
      * Crash reports or core dump files
      * Editor-specific files (.vscode/settings.json local overrides,
        .idea/ directories) — shared, team-useful configs may remain

4.3 PATCH & TEMPORARY SCRIPTS
    - Identify any scripts that were created as temporary fixes and modify source files
      pre-build (e.g. patch scripts, sed/awk scripts run before compile).
    - For each:
      * If it solves a genuine issue: implement the fix properly in source, then
        REMOVE the patch script.
      * If it is still needed temporarily: document WHY it exists, WHAT it does,
        and WHEN it should be removed, in a comment at the top of the script file.
    - Temporary patch scripts should NEVER silently persist without documentation.

4.4 LOCK FILES & DEPENDENCY INTEGRITY
    - Ensure package-lock.json or yarn.lock is committed and up to date.
    - Run a dependency audit and document any known vulnerabilities:
      * npm audit or yarn audit
      * Address critical/high severity issues before shipping.
      * If a vulnerability cannot be immediately patched, add it to a known-issues
        section in the README.

────────────────────────────────────────────────────────────
PHASE 5 — DOCUMENTATION & FIRST-RUN READINESS
────────────────────────────────────────────────────────────

5.1 README VERIFICATION
    - The README must accurately describe:
      * What the application does (user-facing description)
      * Installation instructions for a brand-new user (prerequisites, steps)
      * How to run the application (development and/or production)
      * How to build/package the application
      * Any required environment variables (reference .env.example)
      * Known limitations or platform requirements
    - Remove any README sections that reference internal developer processes,
      test procedures, or scaffolding instructions not relevant to end users.

5.2 FRESH-INSTALL SIMULATION
    - Mentally (or actually) simulate a fresh install:
      * Clone the repo into a new empty directory
      * Run: npm install (or yarn install)
      * Run: npm run build (or equivalent)
      * The application must start and function correctly with ZERO additional
        manual configuration steps beyond what is documented in the README.
    - Flag any step that would fail on a clean machine (missing binary, missing config,
      assumption about global tool) and fix it before marking cleanup complete.

5.3 DEFAULT CONFIGURATION
    - Ensure that on first launch, the application either:
      a) Works immediately with sensible defaults, OR
      b) Guides the user through required configuration (e.g. a setup wizard or
         clear first-run prompt) — never silently failing or showing a blank/broken UI.
    - All default config values must be valid, safe, and not developer-specific.

────────────────────────────────────────────────────────────
PHASE 6 — FINAL PRODUCTION READINESS CHECKLIST
────────────────────────────────────────────────────────────

Before marking this session complete, confirm ALL of the following:

CODE QUALITY
  [ ] No commented-out code blocks remain in source files
  [ ] No unused imports remain in any source file
  [ ] No orphaned / unreferenced source files remain in the project
  [ ] No debug console.log() or debugger statements remain unguarded

SECURITY
  [ ] No secrets, API keys, or tokens are present anywhere in source code
  [ ] .env is gitignored; .env.example exists and is complete
  [ ] All DevTools / debug UI is gated behind a proper isDev / NODE_ENV guard
  [ ] No hardcoded local file paths or developer-machine-specific values remain

TEST POLLUTION
  [ ] All hardcoded test URLs have been removed or replaced with configurable values
  [ ] All test fixture / seed data not needed at runtime has been removed
  [ ] Test files are excluded from the production build output

BUILD & REPO
  [ ] .gitignore covers all build outputs, OS metadata, logs, and secrets
  [ ] No build artifacts are committed to the repository
  [ ] All patch/temp scripts are either properly implemented or documented
  [ ] Lock file is committed and npm audit shows no critical vulnerabilities

FIRST-RUN READINESS
  [ ] README accurately describes installation and usage for a new user
  [ ] Application starts correctly from a clean clone with only documented steps
  [ ] All bundled binary paths resolve correctly at runtime after packaging
  [ ] Default configuration is valid and does not require developer intervention

────────────────────────────────────────────────────────────
FINAL OUTPUT REQUIRED
────────────────────────────────────────────────────────────

After completing all phases, provide:

1. CLEANUP SUMMARY — A structured list of every change made, grouped by phase.
   Format: "Phase X.Y — [Action taken]: [file or item affected]"

2. ISSUES RAISED — Any items that require a follow-up fix, a future PR, or a
   known-issues entry in the README. These are things you found but could not
   fully resolve in this session.

3. PRODUCTION READINESS VERDICT — A clear statement:
   ✅ PRODUCTION READY — All checklist items pass. Safe to build and ship.
   ⚠️  CONDITIONALLY READY — Ready with noted caveats (list them).
   ❌ NOT READY — Blocking issues remain (list them with required actions).