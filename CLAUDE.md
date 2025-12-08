# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

fastify-cache-control is a Fastify plugin for declarative HTTP Cache-Control header management. It's ESM-only, targeting Node.js 20+ and Fastify v5.

## Commands

```bash
# Build
npm run build          # Uses tsup to compile TypeScript

# Test
npm test               # Run all tests with tap
npm test test/plugin.test.ts  # Run single test file

# Lint
npm run lint           # ESLint on src and test directories
```

## Architecture

### Core Files

- `src/types.ts` - TypeScript interfaces for `CacheControlDirectives`, `FastifyCacheControlOptions`, and Fastify module augmentation
- `src/plugin.ts` - Plugin implementation with `onSend` hook for header application
- `src/index.ts` - Public exports

### Header Priority (highest to lowest)

1. `reply.cacheControl()` called in handler
2. `config.cache` in route definition
3. `defaults` in plugin options
4. No header (if nothing configured)

### Reply Decorators

- `reply.cacheControl(directives)` - Set Cache-Control programmatically
- `reply.noCache()` - Shortcut for no-store
- `reply.immutable(maxAge)` - Shortcut for public + max-age + immutable

### Directive Serialization Order

Directives are serialized in this fixed order: public, private, no-cache, no-store, no-transform, must-revalidate, proxy-revalidate, must-understand, immutable, max-age, s-maxage, stale-while-revalidate, stale-if-error

### Validation Rules

- `public` + `private` together throws `FastifyCacheControlError` (code: `CACHE_CONTROL_CONFLICT`)
- Negative `maxAge` throws `FastifyCacheControlError` (code: `CACHE_CONTROL_INVALID_VALUE`)
- Non-integer `maxAge` values are rounded with `Math.round()`
- Empty arrays are ignored
- Existing Cache-Control headers are never overwritten
