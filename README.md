<h1 align="center">Fastify Cache Control</h1>
<h3 align="center">HTTP Cache-Control Header Management</h3>

<p align="center">
  <em>Declarative caching with CDN support and URL patterns</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Fastify-000000?style=flat-square&logo=fastify&logoColor=white" alt="Fastify" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/npm-CB3837?style=flat-square&logo=npm&logoColor=white" alt="npm" />
  <img src="https://img.shields.io/badge/CDN-FF9900?style=flat-square" alt="CDN" />
</p>

<p align="center">
  :gb: <a href="#english">English</a> | :it: <a href="#italiano">Italiano</a>
</p>

---

<a name="english"></a>
## :gb: English

### Overview

A Fastify plugin for declarative HTTP Cache-Control header management. Features CDN support, presets, and URL pattern matching.

### Features

- **Declarative Config** - Simple configuration syntax
- **CDN Support** - Cloudflare, AWS CloudFront, etc.
- **Presets** - Common caching strategies
- **URL Patterns** - Route-based cache rules
- **TypeScript** - Full type support

### Installation

```bash
npm install @fracabu/fastify-cache-control
```

### Usage

```typescript
import fastify from 'fastify'
import cacheControl from '@fracabu/fastify-cache-control'

const app = fastify()

app.register(cacheControl, {
  defaults: { maxAge: 3600 },
  patterns: [
    { path: '/api/*', maxAge: 0 },
    { path: '/static/*', maxAge: 86400 }
  ]
})
```

---

<a name="italiano"></a>
## :it: Italiano

### Panoramica

Plugin Fastify per gestione dichiarativa header HTTP Cache-Control. Supporto CDN, preset e pattern matching URL.

### Funzionalita

- **Config Dichiarativa** - Sintassi configurazione semplice
- **Supporto CDN** - Cloudflare, AWS CloudFront, etc.
- **Preset** - Strategie caching comuni
- **Pattern URL** - Regole cache per route
- **TypeScript** - Supporto tipi completo

### Installazione

```bash
npm install @fracabu/fastify-cache-control
```

### Utilizzo

```typescript
import fastify from 'fastify'
import cacheControl from '@fracabu/fastify-cache-control'

const app = fastify()

app.register(cacheControl, {
  defaults: { maxAge: 3600 },
  patterns: [
    { path: '/api/*', maxAge: 0 },
    { path: '/static/*', maxAge: 86400 }
  ]
})
```

---

## Tech Stack

- Fastify, TypeScript

## License

MIT

---

<p align="center">
  <a href="https://github.com/fracabu">
    <img src="https://img.shields.io/badge/Made_by-fracabu-8B5CF6?style=flat-square" alt="Made by fracabu" />
  </a>
</p>
