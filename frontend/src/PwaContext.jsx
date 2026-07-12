import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { applyUpdate } from './pwa'

// Shares install/standalone state across the app so both the install banner and
// the tutorial's "install" call-to-action can drive the same prompt.
const PwaContext = createContext(null)

function detectStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches ||
    // iOS Safari exposes navigator.standalone instead of display-mode.
    window.navigator.standalone === true
  )
}

function detectIOS() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent || ''
  const iOSDevice = /iphone|ipad|ipod/i.test(ua)
  // iPadOS 13+ reports as a Mac; sniff for touch to catch it.
  const iPadOS = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua)
  return (iOSDevice || iPadOS) && isSafari
}

export function PwaProvider({ children }) {
  // The captured beforeinstallprompt event (Android/desktop Chrome). Null until fired.
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(detectStandalone)
  const [swRegistration, setSwRegistration] = useState(null)
  const isIOS = useMemo(detectIOS, [])

  useEffect(() => {
    const onBeforeInstall = (event) => {
      // Stop Chrome's mini-infobar; we surface our own UI instead.
      event.preventDefault()
      setDeferredPrompt(event)
    }
    const onInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
    }
    const onUpdate = (event) => setSwRegistration(event.detail)

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('florafind:sw-update', onUpdate)

    const mql = window.matchMedia?.('(display-mode: standalone)')
    const onDisplayChange = (e) => setIsStandalone(e.matches || detectStandalone())
    mql?.addEventListener?.('change', onDisplayChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('florafind:sw-update', onUpdate)
      mql?.removeEventListener?.('change', onDisplayChange)
    }
  }, [])

  // Fire the native install prompt. Returns 'accepted' | 'dismissed' | 'unavailable'.
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable'
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return choice?.outcome ?? 'dismissed'
  }, [deferredPrompt])

  const applySwUpdate = useCallback(() => {
    applyUpdate(swRegistration)
    setSwRegistration(null)
  }, [swRegistration])

  const value = useMemo(
    () => ({
      // A native prompt is available (Android / desktop Chrome, Edge, etc.).
      canPromptInstall: !!deferredPrompt,
      // Something can be installed: either a native prompt, or iOS manual steps.
      installable: (!!deferredPrompt || isIOS) && !isStandalone,
      isIOS,
      isStandalone,
      promptInstall,
      updateReady: !!swRegistration,
      applySwUpdate,
    }),
    [deferredPrompt, isIOS, isStandalone, promptInstall, swRegistration, applySwUpdate],
  )

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>
}

export function usePwa() {
  return useContext(PwaContext)
}
