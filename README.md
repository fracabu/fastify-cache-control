# fastify-cache-control

Declarative HTTP Cache-Control headers management for Fastify with CDN support, presets, and pattern matching.

[![npm version](https://img.shields.io/npm/v/fastify-cache-control.svg)](https://www.npmjs.com/package/fastify-cache-control)
[![npm downloads](https://img.shields.io/npm/dm/fastify-cache-control.svg)](https://www.npmjs.com/package/fastify-cache-control)
[![Node.js](https://img.shields.io/node/v/fastify-cache-control.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

![fastify-cache-control infographic](assets/fastify-cache-control-infographic.png)

> 🎬 **Video Demo**: [Coming soon](#)
> 🎙️ **Podcast**: [Coming soon](#)

## Features

- Declarative Cache-Control header management
- Built-in presets for common scenarios (static, api, realtime, etc.)
- Pattern matching rules for route-based caching
- CDN-Cache-Control support (RFC 9213)
- Automatic Vary header generation
- Full TypeScript support
- Zero dependencies (only fastify-plugin)

## Requirements

- Node.js >= 20.0.0
- Fastify >= 5.0.0

## Install

```bash
npm install fastify-cache-control
```

## Quick Start

```typescript
import Fastify from 'fastify'
import cacheControl from 'fastify-cache-control'

const fastify = Fastify()

await fastify.register(cacheControl, {
  defaults: { public: true, maxAge: 3600 }
})

fastify.get('/', async () => {
  return { hello: 'world' }
})
// Response: Cache-Control: public, max-age=3600
```

## Real-World Examples

### E-commerce Website

```typescript
import Fastify from 'fastify'
import cacheControl from 'fastify-cache-control'

const fastify = Fastify()

await fastify.register(cacheControl, {
  // Default: pages can be cached for 5 minutes
  defaults: 'page',

  // URL-based rules
  rules: [
    // Static assets (images, CSS, JS with hash in filename)
    { match: '/assets/*', cache: 'static' },

    // Product images from CDN
    { match: /\/images\/products\//, cache: { public: true, maxAge: 86400 } },

    // Shopping cart - never cache
    { match: '/api/cart/*', cache: false },

    // Product catalog - cache briefly
    { match: '/api/products/*', cache: { public: true, maxAge: 300, staleWhileRevalidate: 60 } },

    // User-specific data
    { match: '/api/user/*', cache: 'private' }
  ],

  // CDN caches longer than browsers
  cdn: {
    directives: { maxAge: 3600 },
    header: 'CDN-Cache-Control'
  }
})

// Product page - uses default 'page' preset
fastify.get('/products/:id', async (request) => {
  const product = await getProduct(request.params.id)
  return product
})
// Response: Cache-Control: public, max-age=3600, must-revalidate

// Checkout - explicitly disable cache
fastify.get('/checkout', {
  config: { cache: false }
}, async (request, reply) => {
  return { step: 1, items: await getCartItems(request) }
})
// Response: Cache-Control: no-store
```

### REST API with Authentication

```typescript
await fastify.register(cacheControl, {
  defaults: 'api',
  rules: [
    // Public endpoints - cacheable
    { match: '/api/v1/public/*', cache: { public: true, maxAge: 300 } },

    // Health check - no cache
    { match: '/api/health', cache: false },

    // Webhooks - no cache
    { match: '/api/webhooks/*', cache: false }
  ]
})

// Public data - anyone can cache
fastify.get('/api/v1/public/stats', async () => {
  return await getPublicStats()
})
// Response: Cache-Control: public, max-age=300

// Authenticated endpoint - per-user cache
fastify.get('/api/v1/me/profile', async (request, reply) => {
  reply.cacheControl({
    private: ['authorization'],  // Varies by auth header
    maxAge: 60,
    mustRevalidate: true
  })
  return await getUserProfile(request.user.id)
})
// Response: Cache-Control: private="authorization", max-age=60, must-revalidate
// Response: Vary: Authorization

// Real-time notifications - never cache
fastify.get('/api/v1/me/notifications', async (request, reply) => {
  reply.noCache()
  return await getNotifications(request.user.id)
})
// Response: Cache-Control: no-store
```

### Static File Server with Versioning

```typescript
await fastify.register(cacheControl, {
  rules: [
    // Versioned assets (e.g., /assets/app.a1b2c3.js) - cache forever
    {
      match: /\/assets\/.*\.[a-f0-9]{6,}\.(js|css|woff2?)$/,
      cache: 'static'  // public, max-age=31536000, immutable
    },

    // Non-versioned assets - short cache with revalidation
    {
      match: '/assets/*',
      cache: { public: true, maxAge: 3600, mustRevalidate: true }
    },

    // HTML files - always revalidate
    {
      match: /\.html$/,
      cache: { public: true, noCache: true }
    }
  ]
})

// Serve versioned JS file
fastify.get('/assets/app.a1b2c3.js', async () => {
  return await readFile('./dist/app.js')
})
// Response: Cache-Control: public, immutable, max-age=31536000

// Serve index.html
fastify.get('/index.html', async () => {
  return await readFile('./dist/index.html')
})
// Response: Cache-Control: public, no-cache
```

### Microservice with Cloudflare CDN

```typescript
await fastify.register(cacheControl, {
  defaults: { public: true, maxAge: 60, sMaxage: 300 },
  cdn: {
    directives: {
      maxAge: 3600,
      staleWhileRevalidate: 600,
      staleIfError: 86400
    },
    header: 'Cloudflare-CDN-Cache-Control'
  }
})

fastify.get('/api/data', async () => {
  return await fetchExpensiveData()
})
// Response headers:
// Cache-Control: public, max-age=60, s-maxage=300
// Cloudflare-CDN-Cache-Control: max-age=3600, stale-while-revalidate=600, stale-if-error=86400
//
// Browser: caches for 60s
// Shared proxies: cache for 300s
// Cloudflare: caches for 1h, serves stale for 10min while revalidating,
//             serves stale for 24h if origin is down
```

### Dynamic Cache Based on Content

```typescript
fastify.get('/api/posts/:id', async (request, reply) => {
  const post = await getPost(request.params.id)

  if (post.status === 'published') {
    // Published posts - cache publicly
    reply.cacheControl({
      public: true,
      maxAge: 3600,
      staleWhileRevalidate: 300
    })
  } else if (post.status === 'draft') {
    // Drafts - private, short cache
    reply.cacheControl({
      private: true,
      maxAge: 60,
      mustRevalidate: true
    })
  } else {
    // Deleted/archived - no cache
    reply.noCache()
  }

  return post
})
```

### Debug Mode for Development

```typescript
await fastify.register(cacheControl, {
  defaults: 'page',
  debug: true,  // Logs cache decisions to console
  disableInDevelopment: false  // Set to true to skip in NODE_ENV=development
})

// Console output:
// [fastify-cache-control] Using default directives
// [fastify-cache-control] Applied: public, max-age=3600, must-revalidate
```

## Options

```typescript
interface FastifyCacheControlOptions {
  // Default directives for all responses
  defaults?: CacheControlDirectives | CachePreset

  // Status codes to apply defaults (default: [200, 201, 204, 206, 301-308])
  statusCodes?: number[]

  // HTTP methods to apply defaults (default: ['GET', 'HEAD'])
  methods?: string[]

  // Pattern-based caching rules
  rules?: CacheRule[]

  // CDN-specific cache control (RFC 9213)
  cdn?: {
    directives?: CacheControlDirectives
    header?: string  // default: 'CDN-Cache-Control'
  }

  // Auto-set Vary header for private/no-cache fields (default: true)
  autoVary?: boolean

  // Disable in development (default: false)
  disableInDevelopment?: boolean

  // Enable debug logging (default: false)
  debug?: boolean
}
```

## Route Configuration

```typescript
// Using directives object
fastify.get('/static', {
  config: {
    cache: {
      public: true,
      maxAge: 86400,
      immutable: true
    }
  }
}, handler)

// Using preset
fastify.get('/assets', {
  config: { cache: 'static' }
}, handler)

// Disable caching
fastify.get('/private', {
  config: { cache: false }  // Sets no-store
}, handler)
```

## Programmatic API

```typescript
fastify.get('/dynamic', async (request, reply) => {
  // Full control
  reply.cacheControl({
    private: true,
    maxAge: 60,
    mustRevalidate: true
  })
  return data
})

// Shortcuts
fastify.get('/secret', async (request, reply) => {
  reply.noCache()  // no-store
  return sensitiveData
})

fastify.get('/versioned', async (request, reply) => {
  reply.immutable(31536000)  // public, max-age=31536000, immutable
  return asset
})

fastify.get('/api', async (request, reply) => {
  reply.cachePreset('api')  // private, no-cache
  return apiData
})
```

## Built-in Presets

| Preset | Directives | Use Case |
|--------|------------|----------|
| `static` | `public, max-age=31536000, immutable` | Fingerprinted static assets |
| `api` | `private, no-cache` | API responses requiring revalidation |
| `realtime` | `no-store` | Real-time data, never cache |
| `page` | `public, max-age=3600, must-revalidate` | Public pages |
| `private` | `private, max-age=60, must-revalidate` | User-specific data |

## Pattern Matching Rules

Apply caching rules based on URL patterns:

```typescript
await fastify.register(cacheControl, {
  rules: [
    // String pattern with wildcard
    { match: '/static/*', cache: 'static' },

    // Regex pattern
    { match: /^\/api\/public\//, cache: { public: true, maxAge: 300 } },

    // Function matcher
    { match: (req) => req.url.includes('admin'), cache: false },

    // Catch-all for API
    { match: '/api/*', cache: 'api' }
  ]
})
```

Rules are evaluated in order; first match wins.

## CDN-Cache-Control (RFC 9213)

Set different cache policies for CDNs vs browsers:

```typescript
await fastify.register(cacheControl, {
  defaults: { public: true, maxAge: 60 },  // Browser: 60s
  cdn: {
    directives: { maxAge: 600 },            // CDN: 600s
    header: 'CDN-Cache-Control'             // or 'Cloudflare-CDN-Cache-Control'
  }
})
```

Response headers:
```
Cache-Control: public, max-age=60
CDN-Cache-Control: max-age=600
```

## Automatic Vary Header

When using `private` or `no-cache` with field names, Vary is automatically set:

```typescript
reply.cacheControl({ private: ['cookie', 'authorization'] })
// Cache-Control: private="cookie, authorization"
// Vary: Cookie, Authorization
```

Disable with `autoVary: false`.

## Priority

Headers are applied in this order (highest to lowest):

1. `reply.cacheControl()` / `reply.noCache()` / etc.
2. Route `config.cache`
3. Pattern matching `rules`
4. Global `defaults`

Manually set `Cache-Control` headers are never overwritten.

## Directives Reference

| Directive | Type | Header Output |
|-----------|------|---------------|
| `public` | `boolean` | `public` |
| `private` | `boolean \| string[]` | `private` or `private="field1, field2"` |
| `noCache` | `boolean \| string[]` | `no-cache` or `no-cache="field"` |
| `noStore` | `boolean` | `no-store` |
| `noTransform` | `boolean` | `no-transform` |
| `mustRevalidate` | `boolean` | `must-revalidate` |
| `proxyRevalidate` | `boolean` | `proxy-revalidate` |
| `mustUnderstand` | `boolean` | `must-understand` |
| `immutable` | `boolean` | `immutable` |
| `maxAge` | `number` | `max-age=N` |
| `sMaxage` | `number` | `s-maxage=N` |
| `staleWhileRevalidate` | `number` | `stale-while-revalidate=N` |
| `staleIfError` | `number` | `stale-if-error=N` |

## Error Handling

The plugin throws `FastifyCacheControlError` for:

- `CACHE_CONTROL_CONFLICT`: Using `public` and `private` together
- `CACHE_CONTROL_INVALID_VALUE`: Negative time values
- `CACHE_CONTROL_INVALID_PRESET`: Unknown preset name

## TypeScript

Full TypeScript support with module augmentation:

```typescript
import type { CacheControlDirectives, CachePreset } from 'fastify-cache-control'

// reply.cacheControl() and reply.noCache() are typed
// config.cache is typed in route options
```

## License

MIT
