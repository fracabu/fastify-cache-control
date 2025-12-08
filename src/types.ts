import type { FastifyRequest, FastifyReply } from 'fastify'

/**
 * Cache-Control directives supported by the plugin
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

  // Expiration directives
  maxAge?: number              // seconds
  sMaxage?: number             // seconds (shared cache)
  staleWhileRevalidate?: number // seconds
  staleIfError?: number        // seconds
}

/**
 * Built-in presets for common caching scenarios
 */
export type CachePreset = 'static' | 'api' | 'realtime' | 'page' | 'private'

/**
 * Preset definitions
 */
export const CACHE_PRESETS: Record<CachePreset, CacheControlDirectives> = {
  // Static assets with fingerprinting (1 year, immutable)
  static: { public: true, maxAge: 31536000, immutable: true },

  // API responses (private, requires revalidation)
  api: { private: true, noCache: true },

  // Real-time data (never cache)
  realtime: { noStore: true },

  // Public pages (1 hour, must revalidate)
  page: { public: true, maxAge: 3600, mustRevalidate: true },

  // Private user data (short TTL)
  private: { private: true, maxAge: 60, mustRevalidate: true }
}

/**
 * Route matching rule for pattern-based caching
 */
export interface CacheRule {
  /**
   * Pattern to match against request URL
   * - string: glob-like pattern (supports * wildcard)
   * - RegExp: regular expression
   * - function: custom matcher
   */
  match: string | RegExp | ((request: FastifyRequest) => boolean)

  /**
   * Cache configuration for matched routes
   */
  cache: CacheControlDirectives | CachePreset | false
}

/**
 * CDN-specific options (RFC 9213)
 */
export interface CdnCacheOptions {
  /**
   * Cache-Control directives for CDN only
   */
  directives?: CacheControlDirectives

  /**
   * Custom CDN header name
   * @default 'CDN-Cache-Control'
   * @example 'Cloudflare-CDN-Cache-Control'
   */
  header?: string
}

/**
 * Plugin global options
 */
export interface FastifyCacheControlOptions {
  /**
   * Default directives applied to all responses
   * @default undefined (no header added by default)
   */
  defaults?: CacheControlDirectives | CachePreset

  /**
   * Apply defaults only to responses with these status codes
   * @default [200, 201, 204, 206, 301, 302, 303, 304, 307, 308]
   */
  statusCodes?: number[]

  /**
   * Apply defaults only to these HTTP methods
   * @default ['GET', 'HEAD']
   */
  methods?: string[]

  /**
   * Pattern-based caching rules (evaluated in order)
   */
  rules?: CacheRule[]

  /**
   * CDN-specific cache control (RFC 9213)
   */
  cdn?: CdnCacheOptions

  /**
   * Automatically set Vary header based on private/no-cache field names
   * @default true
   */
  autoVary?: boolean

  /**
   * Disable plugin in development (NODE_ENV === 'development')
   * @default false
   */
  disableInDevelopment?: boolean

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}

/**
 * Options for route config
 */
export interface RouteCacheConfig {
  cache?: CacheControlDirectives | CachePreset | false  // false = no-store
}

/**
 * Custom error class for cache control errors
 */
export class FastifyCacheControlError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'FastifyCacheControlError'
    this.code = code
  }
}

/**
 * Error codes
 */
export const ErrorCodes = {
  CONFLICT: 'CACHE_CONTROL_CONFLICT',
  INVALID_VALUE: 'CACHE_CONTROL_INVALID_VALUE',
  INVALID_PRESET: 'CACHE_CONTROL_INVALID_PRESET'
} as const

/**
 * Fastify type augmentation
 */
declare module 'fastify' {
  interface FastifyReply {
    /**
     * Set Cache-Control header programmatically
     */
    cacheControl(directives: CacheControlDirectives | CachePreset): FastifyReply

    /**
     * Shortcut: set no-store (disable caching)
     */
    noCache(): FastifyReply

    /**
     * Shortcut: set public, max-age, immutable
     */
    immutable(maxAge: number): FastifyReply

    /**
     * Shortcut: use a preset
     */
    cachePreset(preset: CachePreset): FastifyReply
  }

  interface FastifyContextConfig {
    cache?: CacheControlDirectives | CachePreset | false
  }
}
