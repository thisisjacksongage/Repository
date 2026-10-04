---
name: pnpm workspace installs
description: Installing dependencies and linking packages when the package helper cannot select a pnpm workspace package.
---

When the package helper runs `pnpm add` at the workspace root and pnpm rejects the root install, passing `--filter` as a package token is rejected. Target the intended workspace package with pnpm's native `--filter` option instead. If its dependencies are already declared but are not linked in `node_modules`, run a filtered install for that package.

**Why:** In this workspace the helper did not expose a package selector, while API and web dependencies belong to separate artifact packages.

**How to apply:** Use this only after the package helper cannot target the required workspace; confirm the package name and keep dependencies in that package's manifest.