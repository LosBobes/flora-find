import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'florafind_map_settings'

// Keyless CARTO raster basemaps. `saturation: -1` fully desaturates a tileset.
// `stardew` warms and saturates the pastel Voyager tiles into a cozy farm-game
// look and, like `dark`, re-skins the whole UI (see the class toggle below).
export const MAP_THEMES = [
  { id: 'mono', labelKey: 'themeMono', swatch: '#c9d2c9', tiles: 'light_all', saturation: -1 },
  { id: 'light', labelKey: 'themeLight', swatch: '#eae6dc', tiles: 'light_all', saturation: 0 },
  { id: 'voyager', labelKey: 'themeVoyager', swatch: '#d7e7c9', tiles: 'rastertiles/voyager', saturation: 0 },
  {
    id: 'stardew',
    labelKey: 'themeStardew',
    swatch: '#a7d86e',
    tiles: 'rastertiles/voyager',
    // Push the pastel Voyager tiles toward a sunny, hand-painted farm-map look:
    // richer greens (saturation), a warm golden cast (hueRotate), a little more
    // punch (contrast) and lifted shadows (brightnessMin) so nothing reads as
    // grey — it should feel like sun-warmed parchment, not a street map.
    saturation: 0.55,
    hueRotate: 12,
    contrast: 0.18,
    brightnessMin: 0.06,
  },
  { id: 'dark', labelKey: 'themeDark', swatch: '#2b2f33', tiles: 'dark_all', saturation: 0 },
]

// Marker base diameter in px per size choice; selected markers scale up from here.
export const MARKER_SIZES = [
  { id: 'sm', labelKey: 'sizeSmall', px: 30 },
  { id: 'md', labelKey: 'sizeMedium', px: 42 },
  { id: 'lg', labelKey: 'sizeLarge', px: 56 },
]

const DEFAULTS = { theme: 'mono', markerSize: 'md', showLabels: false }

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

const MapSettingsContext = createContext(null)

export function MapSettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  // The chosen theme re-skins the whole UI, not just the map: the Dark theme
  // flips the app into dark mode via Tailwind's `dark` class on <html>, and the
  // Stardew theme adds a `theme-stardew` class that styles.css hangs a cozy,
  // pixel-art parchment skin off of.
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', settings.theme === 'dark')
    root.classList.toggle('theme-stardew', settings.theme === 'stardew')
  }, [settings.theme])

  const setTheme = useCallback((theme) => setSettings((s) => ({ ...s, theme })), [])
  const setMarkerSize = useCallback((markerSize) => setSettings((s) => ({ ...s, markerSize })), [])
  const toggleLabels = useCallback(() => setSettings((s) => ({ ...s, showLabels: !s.showLabels })), [])

  const value = useMemo(() => {
    const theme = MAP_THEMES.find((t) => t.id === settings.theme) ?? MAP_THEMES[0]
    const markerSize = MARKER_SIZES.find((m) => m.id === settings.markerSize) ?? MARKER_SIZES[1]
    return {
      ...settings,
      themeMeta: theme,
      markerPx: markerSize.px,
      isDark: theme.id === 'dark',
      setTheme,
      setMarkerSize,
      toggleLabels,
    }
  }, [settings, setTheme, setMarkerSize, toggleLabels])

  return <MapSettingsContext.Provider value={value}>{children}</MapSettingsContext.Provider>
}

export function useMapSettings() {
  return useContext(MapSettingsContext)
}

// Build a MapLibre style object for a given theme id (used by MapView).
export function buildBasemapStyle(themeId) {
  const theme = MAP_THEMES.find((t) => t.id === themeId) ?? MAP_THEMES[0]
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: ['a', 'b', 'c'].map(
          (s) => `https://${s}.basemaps.cartocdn.com/${theme.tiles}/{z}/{x}/{y}.png`,
        ),
        tileSize: 256,
        maxzoom: 20,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
        paint: {
          'raster-saturation': theme.saturation,
          ...(theme.hueRotate ? { 'raster-hue-rotate': theme.hueRotate } : {}),
          ...(theme.contrast ? { 'raster-contrast': theme.contrast } : {}),
          ...(theme.brightnessMin ? { 'raster-brightness-min': theme.brightnessMin } : {}),
        },
      },
    ],
  }
}
