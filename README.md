# React Native Starter

Build iOS and Android apps with your AI agent. Powered by bare [React Native](https://reactnative.dev) — full control over the native projects.

## What is this?

A minimal React Native app for building mobile apps with Claude Code inside [Ship Studio](https://www.ship.studio). Open the project and Ship Studio boots a simulator, builds the app, and shows it live in the preview pane — tap, swipe, and type right in the workspace. Just describe what you want, and your agent handles the code.

Prefer not to manage native projects yourself? The Expo starter is the easier path — this one is for when you want direct access to `ios/` and `android/`.

## Getting Started

Open the project in Ship Studio. `npm install` runs CocoaPods automatically (via the `postinstall` script), and the first build takes a few minutes — the build log streams in the app. After that, saved changes appear in the running app within seconds.

**Requirements for the iOS preview:** macOS with Xcode and CocoaPods installed. Ship Studio's "Set up with AI" flow can walk you through this if anything's missing.

## Project Structure

```
App.tsx          # The app — every screen starts here
index.js         # Entry point
ios/             # Native iOS project
android/         # Native Android project
__tests__/       # Jest tests
CLAUDE.md        # Instructions for Claude Code
```

## Useful Commands

```bash
npm test             # Run tests
npm run lint         # Lint
npx tsc --noEmit     # Typecheck
```

---

Built for use with [Claude Code](https://claude.com/claude-code)
