import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import Fastify, { FastifyInstance } from 'fastify'
import cacheControl, {
  serializeDirectives,
  FastifyCacheControlError,
  ErrorCodes,
  CACHE_PRESETS
} from '../src/index.js'

describe('serializeDirectives', () => {
  it('should serialize public directive', () => {
    const result = serializeDirectives({ public: true })
    assert.strictEqual(result, 'public')
  })

  it('should serialize private directive', () => {
    const result = serializeDirectives({ private: true })
    assert.strictEqual(result, 'private')
  })

  it('should serialize private with field names', () => {
    const result = serializeDirectives({ private: ['cookie', 'auth'] })
    assert.strictEqual(result, 'private="cookie, auth"')
  })

  it('should serialize no-cache directive', () => {
    const result = serializeDirectives({ noCache: true })
    assert.strictEqual(result, 'no-cache')
  })

  it('should serialize no-cache with field names', () => {
    const result = serializeDirectives({ noCache: ['set-cookie'] })
    assert.strictEqual(result, 'no-cache="set-cookie"')
  })

  it('should serialize no-store directive', () => {
    const result = serializeDirectives({ noStore: true })
    assert.strictEqual(result, 'no-store')
  })

  it('should serialize max-age directive', () => {
    const result = serializeDirectives({ maxAge: 3600 })
    assert.strictEqual(result, 'max-age=3600')
  })

  it('should serialize s-maxage directive', () => {
    const result = serializeDirectives({ sMaxage: 7200 })
    assert.strictEqual(result, 's-maxage=7200')
  })

  it('should serialize immutable directive', () => {
    const result = serializeDirectives({ immutable: true })
    assert.strictEqual(result, 'immutable')
  })

  it('should serialize stale-while-revalidate directive', () => {
    const result = serializeDirectives({ staleWhileRevalidate: 60 })
    assert.strictEqual(result, 'stale-while-revalidate=60')
  })

  it('should serialize stale-if-error directive', () => {
    const result = serializeDirectives({ staleIfError: 300 })
    assert.strictEqual(result, 'stale-if-error=300')
  })

  it('should serialize multiple directives in correct order', () => {
    const result = serializeDirectives({
      public: true,
      maxAge: 3600,
      staleWhileRevalidate: 60
    })
    assert.strictEqual(result, 'public, max-age=3600, stale-while-revalidate=60')
  })

  it('should serialize complete example', () => {
    const result = serializeDirectives({
      private: true,
      noCache: true,
      mustRevalidate: true
    })
    assert.strictEqual(result, 'private, no-cache, must-revalidate')
  })

  it('should round non-integer maxAge', () => {
    const result = serializeDirectives({ maxAge: 3600.7 })
    assert.strictEqual(result, 'max-age=3601')
  })

  it('should ignore empty arrays', () => {
    const result = serializeDirectives({ private: [], maxAge: 60 })
    assert.strictEqual(result, 'max-age=60')
  })

  it('should throw on public + private conflict', () => {
    assert.throws(
      () => serializeDirectives({ public: true, private: true }),
      (err: Error) => {
        assert(err instanceof FastifyCacheControlError)
        assert.strictEqual(err.code, ErrorCodes.CONFLICT)
        return true
      }
    )
  })

  it('should throw on negative maxAge', () => {
    assert.throws(
      () => serializeDirectives({ maxAge: -1 }),
      (err: Error) => {
        assert(err instanceof FastifyCacheControlError)
        assert.strictEqual(err.code, ErrorCodes.INVALID_VALUE)
        return true
      }
    )
  })
})

describe('plugin integration', () => {
  let fastify: FastifyInstance

  beforeEach(async () => {
    fastify = Fastify()
  })

  it('should apply defaults to GET 200', async () => {
    await fastify.register(cacheControl, {
      defaults: { public: true, maxAge: 3600 }
    })

    fastify.get('/', async () => ({ hello: 'world' }))

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cache-control'], 'public, max-age=3600')
  })

  it('should not apply defaults to POST', async () => {
    await fastify.register(cacheControl, {
      defaults: { public: true, maxAge: 3600 }
    })

    fastify.post('/', async () => ({ hello: 'world' }))

    const response = await fastify.inject({ method: 'POST', url: '/' })
    assert.strictEqual(response.headers['cache-control'], undefined)
  })

  it('should not apply defaults to GET 404', async () => {
    await fastify.register(cacheControl, {
      defaults: { public: true, maxAge: 3600 }
    })

    fastify.get('/exists', async () => ({ hello: 'world' }))

    const response = await fastify.inject({ method: 'GET', url: '/not-found' })
    assert.strictEqual(response.headers['cache-control'], undefined)
  })

  it('should apply route config', async () => {
    await fastify.register(cacheControl)

    fastify.get('/', {
      config: {
        cache: { public: true, maxAge: 86400, immutable: true }
      }
    }, async () => ({ hello: 'world' }))

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cache-control'], 'public, immutable, max-age=86400')
  })

  it('should apply cache: false as no-store', async () => {
    await fastify.register(cacheControl)

    fastify.get('/', {
      config: { cache: false }
    }, async () => ({ hello: 'world' }))

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cache-control'], 'no-store')
  })

  it('should apply preset from route config', async () => {
    await fastify.register(cacheControl)

    fastify.get('/', {
      config: { cache: 'static' }
    }, async () => ({ hello: 'world' }))

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cache-control'], 'public, immutable, max-age=31536000')
  })

  it('should override route config with reply.cacheControl()', async () => {
    await fastify.register(cacheControl)

    fastify.get('/', {
      config: { cache: { public: true, maxAge: 3600 } }
    }, async (request, reply) => {
      reply.cacheControl({ private: true, maxAge: 60 })
      return { hello: 'world' }
    })

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cache-control'], 'private, max-age=60')
  })

  it('should apply reply.noCache()', async () => {
    await fastify.register(cacheControl)

    fastify.get('/', async (request, reply) => {
      reply.noCache()
      return { hello: 'world' }
    })

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cache-control'], 'no-store')
  })

  it('should apply reply.immutable()', async () => {
    await fastify.register(cacheControl)

    fastify.get('/', async (request, reply) => {
      reply.immutable(31536000)
      return { hello: 'world' }
    })

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cache-control'], 'public, immutable, max-age=31536000')
  })

  it('should apply reply.cachePreset()', async () => {
    await fastify.register(cacheControl)

    fastify.get('/', async (request, reply) => {
      reply.cachePreset('api')
      return { hello: 'world' }
    })

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cache-control'], 'private, no-cache')
  })

  it('should not override manually set Cache-Control', async () => {
    await fastify.register(cacheControl, {
      defaults: { public: true, maxAge: 3600 }
    })

    fastify.get('/', async (request, reply) => {
      reply.header('Cache-Control', 'custom-value')
      return { hello: 'world' }
    })

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cache-control'], 'custom-value')
  })
})

describe('pattern matching rules', () => {
  let fastify: FastifyInstance

  beforeEach(async () => {
    fastify = Fastify()
  })

  it('should match string pattern', async () => {
    await fastify.register(cacheControl, {
      rules: [
        { match: '/static', cache: 'static' }
      ]
    })

    fastify.get('/static', async () => ({ file: 'data' }))

    const response = await fastify.inject({ method: 'GET', url: '/static' })
    assert.strictEqual(response.headers['cache-control'], 'public, immutable, max-age=31536000')
  })

  it('should match wildcard pattern', async () => {
    await fastify.register(cacheControl, {
      rules: [
        { match: '/api/*', cache: 'api' }
      ]
    })

    fastify.get('/api/users', async () => ({ users: [] }))

    const response = await fastify.inject({ method: 'GET', url: '/api/users' })
    assert.strictEqual(response.headers['cache-control'], 'private, no-cache')
  })

  it('should match regex pattern', async () => {
    await fastify.register(cacheControl, {
      rules: [
        { match: /^\/assets\//, cache: 'static' }
      ]
    })

    fastify.get('/assets/image.png', async () => ({ data: 'image' }))

    const response = await fastify.inject({ method: 'GET', url: '/assets/image.png' })
    assert.strictEqual(response.headers['cache-control'], 'public, immutable, max-age=31536000')
  })

  it('should match function pattern', async () => {
    await fastify.register(cacheControl, {
      rules: [
        {
          match: (req) => req.url.includes('admin'),
          cache: { noStore: true }
        }
      ]
    })

    fastify.get('/admin/dashboard', async () => ({ admin: true }))

    const response = await fastify.inject({ method: 'GET', url: '/admin/dashboard' })
    assert.strictEqual(response.headers['cache-control'], 'no-store')
  })

  it('should apply first matching rule', async () => {
    await fastify.register(cacheControl, {
      rules: [
        { match: '/api/public/*', cache: { public: true, maxAge: 300 } },
        { match: '/api/*', cache: 'api' }
      ]
    })

    fastify.get('/api/public/data', async () => ({ data: 'public' }))
    fastify.get('/api/private/data', async () => ({ data: 'private' }))

    const publicResponse = await fastify.inject({ method: 'GET', url: '/api/public/data' })
    assert.strictEqual(publicResponse.headers['cache-control'], 'public, max-age=300')

    const privateResponse = await fastify.inject({ method: 'GET', url: '/api/private/data' })
    assert.strictEqual(privateResponse.headers['cache-control'], 'private, no-cache')
  })
})

describe('CDN-Cache-Control (RFC 9213)', () => {
  let fastify: FastifyInstance

  beforeEach(async () => {
    fastify = Fastify()
  })

  it('should set CDN-Cache-Control header', async () => {
    await fastify.register(cacheControl, {
      defaults: { public: true, maxAge: 60 },
      cdn: {
        directives: { maxAge: 600 }
      }
    })

    fastify.get('/', async () => ({ hello: 'world' }))

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cache-control'], 'public, max-age=60')
    assert.strictEqual(response.headers['cdn-cache-control'], 'max-age=600')
  })

  it('should use custom CDN header name', async () => {
    await fastify.register(cacheControl, {
      defaults: { public: true, maxAge: 60 },
      cdn: {
        directives: { maxAge: 3600 },
        header: 'Cloudflare-CDN-Cache-Control'
      }
    })

    fastify.get('/', async () => ({ hello: 'world' }))

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['cloudflare-cdn-cache-control'], 'max-age=3600')
  })
})

describe('auto Vary header', () => {
  let fastify: FastifyInstance

  beforeEach(async () => {
    fastify = Fastify()
  })

  it('should set Vary header for private field names', async () => {
    await fastify.register(cacheControl, {
      defaults: { private: ['cookie', 'authorization'] }
    })

    fastify.get('/', async () => ({ hello: 'world' }))

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['vary'], 'Cookie, Authorization')
  })

  it('should not duplicate existing Vary fields', async () => {
    await fastify.register(cacheControl, {
      defaults: { private: ['cookie'] }
    })

    fastify.get('/', async (request, reply) => {
      reply.header('Vary', 'Accept-Encoding')
      return { hello: 'world' }
    })

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['vary'], 'Accept-Encoding, Cookie')
  })

  it('should disable auto Vary when option is false', async () => {
    await fastify.register(cacheControl, {
      defaults: { private: ['cookie'] },
      autoVary: false
    })

    fastify.get('/', async () => ({ hello: 'world' }))

    const response = await fastify.inject({ method: 'GET', url: '/' })
    assert.strictEqual(response.headers['vary'], undefined)
  })
})

describe('presets', () => {
  it('should have correct static preset', () => {
    assert.deepStrictEqual(CACHE_PRESETS.static, {
      public: true,
      maxAge: 31536000,
      immutable: true
    })
  })

  it('should have correct api preset', () => {
    assert.deepStrictEqual(CACHE_PRESETS.api, {
      private: true,
      noCache: true
    })
  })

  it('should have correct realtime preset', () => {
    assert.deepStrictEqual(CACHE_PRESETS.realtime, {
      noStore: true
    })
  })

  it('should have correct page preset', () => {
    assert.deepStrictEqual(CACHE_PRESETS.page, {
      public: true,
      maxAge: 3600,
      mustRevalidate: true
    })
  })

  it('should have correct private preset', () => {
    assert.deepStrictEqual(CACHE_PRESETS.private, {
      private: true,
      maxAge: 60,
      mustRevalidate: true
    })
  })
})
