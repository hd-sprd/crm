/**
 * Einfacher TTL-basierter In-Memory-Cache für selten geänderte API-Daten
 * (Workflows, Währungen, Custom Fields).
 *
 * Da diese Daten pro Browser-Session identisch sind, sparen wir damit
 * Netzwerk-Roundtrips Frankfurt → Irland bei jedem Seitenaufruf.
 *
 * Kein localStorage – bleibt im JS-Heap, wird bei Hard Reload verworfen.
 */

const _cache = new Map() // key → { data, expiresAt }

/**
 * Gibt gecachte Daten zurück oder ruft fetcher() auf und cached das Ergebnis.
 * @param {string} key        - Cache-Schlüssel
 * @param {number} ttlMs      - Zeit in Millisekunden (z.B. 5 * 60 * 1000)
 * @param {() => Promise} fetcher - Funktion, die den API-Call durchführt
 */
export function withCache(key, ttlMs, fetcher) {
  const cached = _cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.data)
  }
  return fetcher().then(data => {
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs })
    return data
  })
}

/** Einen einzelnen Cache-Eintrag invalidieren (z.B. nach Mutation). */
export function invalidateCache(key) {
  _cache.delete(key)
}

/** Alle Einträge invalidieren, deren Schlüssel mit dem Präfix beginnt. */
export function invalidateCachePrefix(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key)
  }
}
