import { useEffect, useState } from 'react'

// Fetch a short intro summary from Wikipedia for a free-text query (a botanical
// species or a plant-type name). Uses the MediaWiki API with generator=search so
// a near-match still resolves — mirroring the "Learn more" search link — and
// asks for a plain-text, few-sentence intro. Anonymous CORS is enabled via
// origin=*. Best-effort: any network/parse failure resolves to null rather than
// throwing, so a missing summary never breaks the details card.
export async function fetchWikiSummary(query, lang = 'en', { signal } = {}) {
  if (!query) return null
  const host = `https://${lang === 'sr' ? 'sr' : 'en'}.wikipedia.org`
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '1',
    prop: 'extracts|info',
    inprop: 'url',
    exintro: '1',
    explaintext: '1',
    exsentences: '3',
    redirects: '1',
  })
  try {
    const resp = await fetch(`${host}/w/api.php?${params}`, { signal })
    if (!resp.ok) return null
    const data = await resp.json()
    const pages = data?.query?.pages
    if (!pages) return null
    const page = Object.values(pages)[0]
    const extract = page?.extract?.trim()
    if (!extract) return null
    return { extract, title: page.title, url: page.fullurl }
  } catch {
    // AbortError (unmount / query change) and any network error land here.
    return null
  }
}

// Lazily resolve a Wikipedia summary for a plant that has no description yet.
// Skips entirely when `enabled` is false (e.g. the plant already has a
// description) so we never fire a needless request.
export function useWikiSummary(query, lang, enabled) {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    if (!enabled || !query) {
      setSummary(null)
      return
    }
    const controller = new AbortController()
    setSummary(null)
    fetchWikiSummary(query, lang, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setSummary(result)
    })
    return () => controller.abort()
  }, [query, lang, enabled])

  return summary
}
