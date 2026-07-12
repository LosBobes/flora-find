// Service-worker registration for the installable PWA.
//
// Registered only in production builds: the Vite dev server serves modules that
// don't play well with a caching SW, and the SW file itself only exists in the
// built output (it's copied from public/). When a new version is deployed the SW
// picks it up and we broadcast a `florafind:sw-update` event so the UI can offer
// a refresh.

export function registerServiceWorker() {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // A waiting worker on first load means an update is already ready.
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdate(registration)
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdate(registration)
            }
          })
        })
      })
      .catch((err) => {
        console.error('Service worker registration failed', err)
      })

    // Reload once the new worker takes control after we tell it to skip waiting.
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}

function notifyUpdate(registration) {
  window.dispatchEvent(new CustomEvent('florafind:sw-update', { detail: registration }))
}

// Tell the waiting worker to activate; controllerchange (above) reloads the page.
export function applyUpdate(registration) {
  registration?.waiting?.postMessage('SKIP_WAITING')
}
