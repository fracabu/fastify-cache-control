// Main plugin export
export { default } from './plugin.js'
export { default as fastifyCacheControl } from './plugin.js'

// Utility exports
export { serializeDirectives } from './plugin.js'

// Type exports
export {
  type CacheControlDirectives,
  type CachePreset,
  type CacheRule,
  type CdnCacheOptions,
  type FastifyCacheControlOptions,
  type RouteCacheConfig,
  CACHE_PRESETS,
  FastifyCacheControlError,
  ErrorCodes
} from './types.js'
