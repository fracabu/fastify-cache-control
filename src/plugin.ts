import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import {
  type CacheControlDirectives,
  type CachePreset,
  type FastifyCacheControlOptions,
  type CacheRule,
  CACHE_PRESETS,
  FastifyCacheControlError,
  ErrorCodes
} from './types.js'

/**
 * Directive serialization order for consistent output
 */
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
] as const

/**
 * Default cacheable status codes
 */
const DEFAULT_STATUS_CODES = [200, 201, 204, 206, 301, 302, 303, 304, 307, 308]

/**
 * Default cacheable methods
 */
const DEFAULT_METHODS = ['GET', 'HEAD']

/**
 * Symbol to store cache directives on reply
 */
const CACHE_SYMBOL = Symbol('fastify-cache-control')

/**
 * Resolve preset to directives
 */
function resolveDirectives(
  value: CacheControlDirectives | CachePreset | false | undefined
): CacheControlDirectives | false | undefined {
  if (value === false) return false
  if (value === undefined) return undefined
  if (typeof value === 'string') {
    const preset = CACHE_PRESETS[value]
    if (!preset) {
      throw new FastifyCacheControlError(
        `Invalid preset: ${value}. Valid presets: ${Object.keys(CACHE_PRESETS).join(', ')}`,
        ErrorCodes.INVALID_PRESET
      )
    }
    return preset
  }
  return value
}

/**
 * Validate directives for conflicts
 */
function validateDirectives(directives: CacheControlDirectives): void {
  // public + private conflict
  if (directives.public && directives.private) {
    throw new FastifyCacheControlError(
      'Cannot use both "public" and "private" directives',
      ErrorCodes.CONFLICT
    )
  }

  // Negative maxAge
  if (directives.maxAge !== undefined && directives.maxAge < 0) {
    throw new FastifyCacheControlError(
      'maxAge cannot be negative',
      ErrorCodes.INVALID_VALUE
    )
  }

  // Negative sMaxage
  if (directives.sMaxage !== undefined && directives.sMaxage < 0) {
    throw new FastifyCacheControlError(
      'sMaxage cannot be negative',
      ErrorCodes.INVALID_VALUE
    )
  }

  // Negative staleWhileRevalidate
  if (directives.staleWhileRevalidate !== undefined && directives.staleWhileRevalidate < 0) {
    throw new FastifyCacheControlError(
      'staleWhileRevalidate cannot be negative',
      ErrorCodes.INVALID_VALUE
    )
  }

  // Negative staleIfError
  if (directives.staleIfError !== undefined && directives.staleIfError < 0) {
    throw new FastifyCacheControlError(
      'staleIfError cannot be negative',
      ErrorCodes.INVALID_VALUE
    )
  }
}

/**
 * Serialize directives to Cache-Control header string
 */
export function serializeDirectives(directives: CacheControlDirectives): string {
  validateDirectives(directives)

  const parts: string[] = []

  // Build directive map
  const directiveMap = new Map<string, string | true>()

  if (directives.public) {
    directiveMap.set('public', true)
  }

  if (directives.private) {
    if (Array.isArray(directives.private)) {
      if (directives.private.length > 0) {
        directiveMap.set('private', `"${directives.private.join(', ')}"`)
      }
    } else {
      directiveMap.set('private', true)
    }
  }

  if (directives.noCache) {
    if (Array.isArray(directives.noCache)) {
      if (directives.noCache.length > 0) {
        directiveMap.set('no-cache', `"${directives.noCache.join(', ')}"`)
      }
    } else {
      directiveMap.set('no-cache', true)
    }
  }

  if (directives.noStore) {
    directiveMap.set('no-store', true)
  }

  if (directives.noTransform) {
    directiveMap.set('no-transform', true)
  }

  if (directives.mustRevalidate) {
    directiveMap.set('must-revalidate', true)
  }

  if (directives.proxyRevalidate) {
    directiveMap.set('proxy-revalidate', true)
  }

  if (directives.mustUnderstand) {
    directiveMap.set('must-understand', true)
  }

  if (directives.immutable) {
    directiveMap.set('immutable', true)
  }

  if (directives.maxAge !== undefined) {
    directiveMap.set('max-age', String(Math.round(directives.maxAge)))
  }

  if (directives.sMaxage !== undefined) {
    directiveMap.set('s-maxage', String(Math.round(directives.sMaxage)))
  }

  if (directives.staleWhileRevalidate !== undefined) {
    directiveMap.set('stale-while-revalidate', String(Math.round(directives.staleWhileRevalidate)))
  }

  if (directives.staleIfError !== undefined) {
    directiveMap.set('stale-if-error', String(Math.round(directives.staleIfError)))
  }

  // Serialize in order
  for (const directive of DIRECTIVE_ORDER) {
    const value = directiveMap.get(directive)
    if (value === true) {
      parts.push(directive)
    } else if (value !== undefined) {
      parts.push(`${directive}=${value}`)
    }
  }

  return parts.join(', ')
}

/**
 * Extract field names from directives for Vary header
 */
function extractVaryFields(directives: CacheControlDirectives): string[] {
  const fields: string[] = []

  if (Array.isArray(directives.private)) {
    fields.push(...directives.private)
  }

  if (Array.isArray(directives.noCache)) {
    fields.push(...directives.noCache)
  }

  // Normalize field names to header format
  return [...new Set(fields)].map(field => {
    // Convert common field names to proper header names
    const normalized = field.toLowerCase()
    if (normalized === 'cookie') return 'Cookie'
    if (normalized === 'authorization' || normalized === 'auth') return 'Authorization'
    // Capitalize first letter of each word
    return field.split('-').map(part =>
      part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    ).join('-')
  })
}

/**
 * Check if request matches a rule pattern
 */
function matchesRule(request: FastifyRequest, rule: CacheRule): boolean {
  const { match } = rule
  const url = request.url

  if (typeof match === 'function') {
    return match(request)
  }

  if (match instanceof RegExp) {
    return match.test(url)
  }

  // String pattern with wildcard support
  if (match.includes('*')) {
    const regexPattern = match
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // Convert * to .*
    return new RegExp(`^${regexPattern}$`).test(url)
  }

  return url === match || url.startsWith(match)
}

/**
 * Find matching rule for request
 */
function findMatchingRule(request: FastifyRequest, rules: CacheRule[]): CacheRule | undefined {
  for (const rule of rules) {
    if (matchesRule(request, rule)) {
      return rule
    }
  }
  return undefined
}

/**
 * Debug logger
 */
function debugLog(options: FastifyCacheControlOptions, message: string, ...args: unknown[]): void {
  if (options.debug) {
    console.log(`[fastify-cache-control] ${message}`, ...args)
  }
}

/**
 * Main plugin implementation
 */
async function fastifyCacheControlPlugin(
  fastify: FastifyInstance,
  options: FastifyCacheControlOptions = {}
): Promise<void> {
  const {
    defaults,
    statusCodes = DEFAULT_STATUS_CODES,
    methods = DEFAULT_METHODS,
    rules = [],
    cdn,
    autoVary = true,
    disableInDevelopment = false,
    debug = false
  } = options

  // Check if disabled in development
  if (disableInDevelopment && process.env.NODE_ENV === 'development') {
    debugLog(options, 'Plugin disabled in development mode')
    return
  }

  // Resolve default directives
  const resolvedDefaults = resolveDirectives(defaults)

  // Decorate reply with cache control methods
  fastify.decorateReply(CACHE_SYMBOL, null)

  fastify.decorateReply('cacheControl', function (
    this: FastifyReply,
    directives: CacheControlDirectives | CachePreset
  ): FastifyReply {
    const resolved = resolveDirectives(directives)
    if (resolved) {
      (this as unknown as Record<symbol, unknown>)[CACHE_SYMBOL] = resolved
    }
    return this
  })

  fastify.decorateReply('noCache', function (this: FastifyReply): FastifyReply {
    (this as unknown as Record<symbol, unknown>)[CACHE_SYMBOL] = { noStore: true }
    return this
  })

  fastify.decorateReply('immutable', function (
    this: FastifyReply,
    maxAge: number
  ): FastifyReply {
    (this as unknown as Record<symbol, unknown>)[CACHE_SYMBOL] = {
      public: true,
      maxAge,
      immutable: true
    }
    return this
  })

  fastify.decorateReply('cachePreset', function (
    this: FastifyReply,
    preset: CachePreset
  ): FastifyReply {
    const resolved = resolveDirectives(preset)
    if (resolved) {
      (this as unknown as Record<symbol, unknown>)[CACHE_SYMBOL] = resolved
    }
    return this
  })

  // Add onSend hook to apply headers
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Skip if Cache-Control already set manually
    if (reply.getHeader('Cache-Control')) {
      debugLog(options, 'Skipping - Cache-Control already set')
      return payload
    }

    // Check method
    if (!methods.includes(request.method)) {
      debugLog(options, `Skipping - method ${request.method} not in allowed list`)
      return payload
    }

    // Check status code
    if (!statusCodes.includes(reply.statusCode)) {
      debugLog(options, `Skipping - status ${reply.statusCode} not in allowed list`)
      return payload
    }

    // Determine directives (priority: reply > route config > rules > defaults)
    let directives: CacheControlDirectives | false | undefined

    // 1. Check reply-level directives (highest priority)
    const replyDirectives = (reply as unknown as Record<symbol, unknown>)[CACHE_SYMBOL] as
      CacheControlDirectives | undefined
    if (replyDirectives) {
      directives = replyDirectives
      debugLog(options, 'Using reply-level directives')
    }

    // 2. Check route config
    if (directives === undefined) {
      const routeConfig = reply.routeOptions?.config?.cache
      if (routeConfig !== undefined) {
        directives = resolveDirectives(routeConfig)
        debugLog(options, 'Using route config directives')
      }
    }

    // 3. Check pattern rules
    if (directives === undefined && rules.length > 0) {
      const matchedRule = findMatchingRule(request, rules)
      if (matchedRule) {
        directives = resolveDirectives(matchedRule.cache)
        debugLog(options, `Using rule match: ${matchedRule.match}`)
      }
    }

    // 4. Fall back to defaults
    if (directives === undefined && resolvedDefaults) {
      directives = resolvedDefaults
      debugLog(options, 'Using default directives')
    }

    // Apply directives
    if (directives === false) {
      // Explicit no-store
      reply.header('Cache-Control', 'no-store')
      debugLog(options, 'Applied no-store (cache: false)')
    } else if (directives) {
      const headerValue = serializeDirectives(directives)
      reply.header('Cache-Control', headerValue)
      debugLog(options, `Applied: ${headerValue}`)

      // Auto-set Vary header
      if (autoVary) {
        const varyFields = extractVaryFields(directives)
        if (varyFields.length > 0) {
          const existingVary = reply.getHeader('Vary')
          const existingFields = existingVary
            ? String(existingVary).split(',').map(f => f.trim())
            : []
          const allFields = [...new Set([...existingFields, ...varyFields])]
          reply.header('Vary', allFields.join(', '))
          debugLog(options, `Set Vary: ${allFields.join(', ')}`)
        }
      }

      // Apply CDN-Cache-Control if configured
      if (cdn?.directives) {
        const cdnHeader = cdn.header || 'CDN-Cache-Control'
        const cdnValue = serializeDirectives(cdn.directives)
        reply.header(cdnHeader, cdnValue)
        debugLog(options, `Applied ${cdnHeader}: ${cdnValue}`)
      }
    }

    return payload
  })
}

/**
 * Export plugin wrapped with fastify-plugin
 */
export default fp(fastifyCacheControlPlugin, {
  name: 'fastify-cache-control',
  fastify: '5.x'
})
