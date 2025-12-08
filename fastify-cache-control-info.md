# Specifiche: fastify-cache-control

Plugin Fastify per gestione dichiarativa di HTTP Cache-Control headers.

---

## 1. Metadata Progetto

```yaml
name: fastify-cache-control
version: 1.0.0
description: Declarative HTTP Cache-Control headers management for Fastify
license: MIT
author: fracabu
keywords:
  - fastify
  - fastify-plugin
  - cache
  - cache-control
  - http-cache
  - caching
  - headers
engines:
  node: ">=20.0.0"
type: module
```

---

## 2. Struttura Directory

```
fastify-cache-control/
├── src/
│   ├── index.ts              # Entry point, export plugin
│   ├── plugin.ts             # Implementazione plugin
│   └── types.ts              # TypeScript types/interfaces
├── test/
│   ├── plugin.test.ts        # Test principali
│   └── helpers.ts            # Test utilities
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── .npmignore
├── README.md
├── LICENSE
└── CHANGELOG.md
```

---

## 3. Dipendenze

```json
{
  "dependencies": {
    "fastify-plugin": "^5.0.0"
  },
  "devDependencies": {
    "fastify": "^5.0.0",
    "typescript": "^5.7.0",
    "tsup": "^8.3.0",
    "@types/node": "^22.0.0",
    "tap": "^21.0.0"
  },
  "peerDependencies": {
    "fastify": "^5.0.0"
  }
}
```

---

## 4. TypeScript Types (src/types.ts)

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify'

/**
 * Direttive Cache-Control supportate
 */
export interface CacheControlDirectives {
  // Response directives
  public?: boolean
  private?: boolean | string[]  // string[] = field names
  noCache?: boolean | string[]  // string[] = field names
  noStore?: boolean
  noTransform?: boolean
  mustRevalidate?: boolean
  proxyRevalidate?: boolean
  mustUnderstand?: boolean
  immutable?: boolean
  
  // Expiration
  maxAge?: number              // secondi
  sMaxage?: number             // secondi (shared cache)
  staleWhileRevalidate?: number // secondi
  staleIfError?: number        // secondi
}

/**
 * Opzioni plugin globali
 */
export interface FastifyCacheControlOptions {
  /**
   * Direttive default applicate a tutte le risposte
   * @default undefined (nessun header aggiunto di default)
   */
  defaults?: CacheControlDirectives
  
  /**
   * Applica defaults solo a risposte con questi status codes
   * @default [200, 201, 204, 206, 301, 302, 303, 304, 307, 308]
   */
  statusCodes?: number[]
  
  /**
   * Applica defaults solo a questi metodi HTTP
   * @default ['GET', 'HEAD']
   */
  methods?: string[]
  
  /**
   * Disabilita plugin in development
   * @default false
   */
  disableInDevelopment?: boolean
}

/**
 * Opzioni per route config
 */
export interface RouteCacheConfig {
  cache?: CacheControlDirectives | false  // false = no-store
}

/**
 * Estensione FastifyReply
 */
declare module 'fastify' {
  interface FastifyReply {
    /**
     * Imposta Cache-Control header programmaticamente
     */
    cacheControl(directives: CacheControlDirectives): FastifyReply
    
    /**
     * Shortcut: imposta no-store
     */
    noCache(): FastifyReply
    
    /**
     * Shortcut: imposta immutable con maxAge
     */
    immutable(maxAge: number): FastifyReply
  }
  
  interface FastifyContextConfig {
    cache?: CacheControlDirectives | false
  }
}
```

---

## 5. Logica di Serializzazione Header

### 5.1 Regole di Serializzazione

```typescript
/**
 * INPUT: { public: true, maxAge: 3600, staleWhileRevalidate: 60 }
 * OUTPUT: "public, max-age=3600, stale-while-revalidate=60"
 * 
 * INPUT: { private: ['cookie'], noCache: true, mustRevalidate: true }
 * OUTPUT: "private="cookie", no-cache, must-revalidate"
 * 
 * INPUT: { private: true, maxAge: 0, noStore: true }
 * OUTPUT: "private, no-store, max-age=0"
 */
```

### 5.2 Mapping Direttive → Header String

| Proprietà | Header Output |
|-----------|---------------|
| `public: true` | `public` |
| `private: true` | `private` |
| `private: ['cookie', 'auth']` | `private="cookie, auth"` |
| `noCache: true` | `no-cache` |
| `noCache: ['set-cookie']` | `no-cache="set-cookie"` |
| `noStore: true` | `no-store` |
| `noTransform: true` | `no-transform` |
| `mustRevalidate: true` | `must-revalidate` |
| `proxyRevalidate: true` | `proxy-revalidate` |
| `mustUnderstand: true` | `must-understand` |
| `immutable: true` | `immutable` |
| `maxAge: 3600` | `max-age=3600` |
| `sMaxage: 7200` | `s-maxage=7200` |
| `staleWhileRevalidate: 60` | `stale-while-revalidate=60` |
| `staleIfError: 300` | `stale-if-error=300` |

### 5.3 Ordine Direttive (per consistency)

```typescript
const DIRECTIVE_ORDER = [
  'public',
  'private', 
  'no-cache',
  'no-store',
  'no-transform',
  'must-revalidate',
  'proxy-revalidate',
  'must-understand',
  'immutable',
  'max-age',
  's-maxage',
  'stale-while-revalidate',
  'stale-if-error'
]
```

---

## 6. Comportamento Plugin

### 6.1 Registrazione

```typescript
import Fastify from 'fastify'
import cacheControl from 'fastify-cache-control'

const fastify = Fastify()

// Senza opzioni (nessun default, solo decoratori)
await fastify.register(cacheControl)

// Con defaults globali
await fastify.register(cacheControl, {
  defaults: {
    public: true,
    maxAge: 3600
  },
  statusCodes: [200, 201],
  methods: ['GET']
})
```

### 6.2 Route Config

```typescript
// Via route config
fastify.get('/static', {
  config: {
    cache: {
      public: true,
      maxAge: 86400,
      immutable: true
    }
  }
}, handler)

// Disabilita cache (no-store)
fastify.get('/private-data', {
  config: {
    cache: false  // Equivale a no-store
  }
}, handler)

// Nessun config = usa defaults (se definiti)
fastify.get('/normal', handler)
```

### 6.3 Programmatico (Reply Decorator)

```typescript
fastify.get('/dynamic', async (request, reply) => {
  const data = await getData()
  
  // Cache breve per dati dinamici
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

fastify.get('/versioned-asset', async (request, reply) => {
  reply.immutable(31536000)  // public, max-age=31536000, immutable
  return asset
})
```

### 6.4 Priorità (dalla più alta alla più bassa)

1. `reply.cacheControl()` chiamato nel handler
2. `config.cache` nella definizione route
3. `defaults` nelle opzioni plugin
4. Nessun header (se nulla è configurato)

### 6.5 Hook Utilizzato

```typescript
// Usare onSend hook per applicare headers
fastify.addHook('onSend', async (request, reply, payload) => {
  // Logica qui
})
```

---

## 7. Validazione e Edge Cases

### 7.1 Conflitti Direttive

```typescript
// public + private = ERRORE (throw)
{ public: true, private: true }  // ❌ FastifyCacheControlError

// noStore rende altre direttive inutili ma non è errore
{ noStore: true, maxAge: 3600 }  // ⚠️ Warning in development, OK in prod
```

### 7.2 Valori Invalidi

```typescript
// maxAge negativo = ERRORE
{ maxAge: -1 }  // ❌ FastifyCacheControlError

// maxAge non intero = arrotonda
{ maxAge: 3600.5 }  // → max-age=3601 (Math.round)

// Array vuoto = ignora direttiva
{ private: [] }  // → nessun output per private
```

### 7.3 Header Già Presente

```typescript
// Se Cache-Control è già stato impostato manualmente, NON sovrascrivere
reply.header('Cache-Control', 'custom-value')
// Il plugin non modifica l'header esistente
```

---

## 8. Error Handling

```typescript
/**
 * Errore custom del plugin
 */
export class FastifyCacheControlError extends Error {
  code: string
  
  constructor(message: string, code: string) {
    super(message)
    this.name = 'FastifyCacheControlError'
    this.code = code
  }
}

// Codici errore
// CACHE_CONTROL_CONFLICT: public + private insieme
// CACHE_CONTROL_INVALID_VALUE: valore non valido (es. maxAge negativo)
```

---

## 9. Test Cases Richiesti

### 9.1 Unit Tests (serializzazione)

```typescript
// test/plugin.test.ts

// Test: serializzazione direttive singole
test('serializza public', ...)
test('serializza private con field names', ...)
test('serializza maxAge', ...)
test('serializza combinazione completa', ...)

// Test: ordine consistente
test('ordine direttive è deterministico', ...)
```

### 9.2 Integration Tests (plugin)

```typescript
// Test: defaults applicati
test('applica defaults a GET 200', ...)
test('non applica defaults a POST', ...)
test('non applica defaults a GET 404', ...)

// Test: route config
test('route config sovrascrive defaults', ...)
test('cache: false imposta no-store', ...)

// Test: reply decorator
test('reply.cacheControl() imposta header', ...)
test('reply.cacheControl() sovrascrive route config', ...)
test('reply.noCache() imposta no-store', ...)
test('reply.immutable() imposta public + maxAge + immutable', ...)

// Test: edge cases
test('non sovrascrive header esistente', ...)
test('errore su public + private', ...)
test('errore su maxAge negativo', ...)
test('ignora array vuoti', ...)
```

### 9.3 Test Coverage Target

- Statements: >95%
- Branches: >90%
- Functions: >95%
- Lines: >95%

---

## 10. Configurazioni Build

### 10.1 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### 10.2 tsup.config.ts

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  outDir: 'dist'
})
```

### 10.3 package.json (exports)

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup",
    "test": "tap test/**/*.test.ts",
    "lint": "eslint src test",
    "prepublishOnly": "npm run build && npm test"
  }
}
```

---

## 11. README.md Structure

```markdown
# fastify-cache-control

Declarative HTTP Cache-Control headers for Fastify.

## Install
## Quick Start  
## Options
## Route Configuration
## Programmatic API
### reply.cacheControl(directives)
### reply.noCache()
### reply.immutable(maxAge)
## Directives Reference
## Priority
## TypeScript
## License
```

---

## 12. Vincoli Implementativi

1. **DEVE** usare `fastify-plugin` con `name: 'fastify-cache-control'`
2. **DEVE** supportare Fastify v5
3. **DEVE** essere ESM-only (`"type": "module"`)
4. **DEVE** avere zero dipendenze runtime (solo `fastify-plugin`)
5. **DEVE** esporre tipi TypeScript corretti
6. **NON DEVE** modificare headers già impostati manualmente
7. **DEVE** lanciare errori sincroni per conflitti (public+private)
8. **DEVE** usare `onSend` hook

---

## 13. Output Atteso dall'Agente

L'agente deve produrre:

1. `src/types.ts` - Tutte le interfacce TypeScript
2. `src/plugin.ts` - Implementazione plugin completa
3. `src/index.ts` - Export pubblici
4. `test/plugin.test.ts` - Test completi con tap
5. `package.json` - Configurazione completa
6. `tsconfig.json` - Configurazione TypeScript
7. `tsup.config.ts` - Configurazione build
8. `README.md` - Documentazione

---

