<h1 align="center">fastify-cache-control</h1>
<h3 align="center">Declarative HTTP Cache-Control headers management for Fastify</h3>

<p align="center">
  <em>CDN support, presets, and pattern matching</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/fastify-cache-control"><img src="https://img.shields.io/npm/v/fastify-cache-control.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/fastify-cache-control"><img src="https://img.shields.io/npm/dm/fastify-cache-control.svg" alt="npm downloads" /></a>
  <img src="https://img.shields.io/node/v/fastify-cache-control.svg" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" />
</p>

<p align="center">
  :gb: <a href="#english">English</a> | :it: <a href="#italiano">Italiano</a>
</p>

---

## Overview

![fastify-cache-control overview](assets/fastify-cache-control-overview.png)

---

<a name="english"></a>
## :gb: English

### Features

- Declarative Cache-Control header management
- Built-in presets for common scenarios (static, api, realtime, etc.)
- Pattern matching rules for route-based caching
- CDN-Cache-Control support (RFC 9213)
- Automatic Vary header generation
- Full TypeScript support
- Zero dependencies (only fastify-plugin)

### Requirements

- Node.js >= 20.0.0
- Fastify >= 5.0.0

### Install

```bash
npm install fastify-cache-control
```

### Quick Start

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

### Real-World Examples

#### E-commerce Website

```typescript
await fastify.register(cacheControl, {
  defaults: 'page',
  rules: [
    { match: '/assets/*', cache: 'static' },
    { match: '/api/cart/*', cache: false },
    { match: '/api/products/*', cache: { public: true, maxAge: 300 } },
    { match: '/api/user/*', cache: 'private' }
  ],
  cdn: {
    directives: { maxAge: 3600 },
    header: 'CDN-Cache-Control'
  }
})
```

#### REST API with Authentication

```typescript
await fastify.register(cacheControl, {
  defaults: 'api',
  rules: [
    { match: '/api/v1/public/*', cache: { public: true, maxAge: 300 } },
    { match: '/api/health', cache: false },
    { match: '/api/webhooks/*', cache: false }
  ]
})
```

### Built-in Presets

| Preset | Directives | Use Case |
|--------|------------|----------|
| `static` | `public, max-age=31536000, immutable` | Fingerprinted static assets |
| `api` | `private, no-cache` | API responses requiring revalidation |
| `realtime` | `no-store` | Real-time data, never cache |
| `page` | `public, max-age=3600, must-revalidate` | Public pages |
| `private` | `private, max-age=60, must-revalidate` | User-specific data |

### Programmatic API

```typescript
// Full control
reply.cacheControl({ private: true, maxAge: 60, mustRevalidate: true })

// Shortcuts
reply.noCache()                    // no-store
reply.immutable(31536000)          // public, max-age=31536000, immutable
reply.cachePreset('api')           // private, no-cache
```

### CDN-Cache-Control (RFC 9213)

```typescript
await fastify.register(cacheControl, {
  defaults: { public: true, maxAge: 60 },   // Browser: 60s
  cdn: {
    directives: { maxAge: 600 },             // CDN: 600s
    header: 'CDN-Cache-Control'
  }
})
```

### Priority

1. `reply.cacheControl()` / `reply.noCache()` / etc.
2. Route `config.cache`
3. Pattern matching `rules`
4. Global `defaults`

---

<a name="italiano"></a>
## :it: Italiano

### Funzionalita

- Gestione dichiarativa degli header Cache-Control
- Preset integrati per scenari comuni (static, api, realtime, ecc.)
- Pattern matching per caching basato su route
- Supporto CDN-Cache-Control (RFC 9213)
- Generazione automatica header Vary
- Supporto TypeScript completo
- Zero dipendenze (solo fastify-plugin)

### Requisiti

- Node.js >= 20.0.0
- Fastify >= 5.0.0

### Installazione

```bash
npm install fastify-cache-control
```

### Quick Start

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
// Risposta: Cache-Control: public, max-age=3600
```

### Esempi Reali

#### Sito E-commerce

```typescript
await fastify.register(cacheControl, {
  defaults: 'page',
  rules: [
    { match: '/assets/*', cache: 'static' },       // Asset statici
    { match: '/api/cart/*', cache: false },        // Carrello: mai cache
    { match: '/api/products/*', cache: { public: true, maxAge: 300 } },
    { match: '/api/user/*', cache: 'private' }     // Dati utente
  ],
  cdn: {
    directives: { maxAge: 3600 },
    header: 'CDN-Cache-Control'
  }
})
```

#### REST API con Autenticazione

```typescript
await fastify.register(cacheControl, {
  defaults: 'api',
  rules: [
    { match: '/api/v1/public/*', cache: { public: true, maxAge: 300 } },
    { match: '/api/health', cache: false },
    { match: '/api/webhooks/*', cache: false }
  ]
})
```

### Preset Integrati

| Preset | Direttive | Caso d'Uso |
|--------|-----------|------------|
| `static` | `public, max-age=31536000, immutable` | Asset statici con fingerprint |
| `api` | `private, no-cache` | API che richiedono rivalidazione |
| `realtime` | `no-store` | Dati real-time, mai cache |
| `page` | `public, max-age=3600, must-revalidate` | Pagine pubbliche |
| `private` | `private, max-age=60, must-revalidate` | Dati specifici utente |

### API Programmatica

```typescript
// Controllo completo
reply.cacheControl({ private: true, maxAge: 60, mustRevalidate: true })

// Scorciatoie
reply.noCache()                    // no-store
reply.immutable(31536000)          // public, max-age=31536000, immutable
reply.cachePreset('api')           // private, no-cache
```

### CDN-Cache-Control (RFC 9213)

```typescript
await fastify.register(cacheControl, {
  defaults: { public: true, maxAge: 60 },   // Browser: 60s
  cdn: {
    directives: { maxAge: 600 },             // CDN: 600s
    header: 'CDN-Cache-Control'
  }
})
```

### Priorita

1. `reply.cacheControl()` / `reply.noCache()` / ecc.
2. Route `config.cache`
3. Pattern matching `rules`
4. `defaults` globali

---

## Options Reference

```typescript
interface FastifyCacheControlOptions {
  defaults?: CacheControlDirectives | CachePreset
  statusCodes?: number[]        // default: [200, 201, 204, 206, 301-308]
  methods?: string[]            // default: ['GET', 'HEAD']
  rules?: CacheRule[]
  cdn?: { directives?: CacheControlDirectives; header?: string }
  autoVary?: boolean            // default: true
  disableInDevelopment?: boolean
  debug?: boolean
}
```

## Directives Reference

| Directive | Type | Header Output |
|-----------|------|---------------|
| `public` | `boolean` | `public` |
| `private` | `boolean \| string[]` | `private` or `private="field"` |
| `noCache` | `boolean \| string[]` | `no-cache` or `no-cache="field"` |
| `noStore` | `boolean` | `no-store` |
| `maxAge` | `number` | `max-age=N` |
| `sMaxage` | `number` | `s-maxage=N` |
| `immutable` | `boolean` | `immutable` |
| `mustRevalidate` | `boolean` | `must-revalidate` |
| `staleWhileRevalidate` | `number` | `stale-while-revalidate=N` |
| `staleIfError` | `number` | `stale-if-error=N` |

---

## License

MIT

---

<p align="center">
  <strong>fastify-cache-control</strong> — Part of the Fastify Ecosystem
</p>

<p align="center">
  <a href="https://github.com/fracabu">
    <img src="https://img.shields.io/badge/Made_by-fracabu-8B5CF6?style=flat-square" alt="Made by fracabu" />
  </a>
</p>
