import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useI18n } from './i18n'

const PlantTypesContext = createContext(null)

// Loads the managed plant-type vocabulary once and shares it: the localized
// label for a stored (English) type, the types available in a category, and an
// admin-only helper to add a new type.
export function PlantTypesProvider({ children }) {
  const { lang } = useI18n()
  const [types, setTypes] = useState([])

  const refresh = useCallback(async () => {
    try {
      setTypes(await api.listPlantTypes())
    } catch {
      /* leave the current list in place on a transient failure */
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // English (canonical) name -> type, for translating stored values.
  const byCanonical = useMemo(() => {
    const map = new Map()
    for (const type of types) map.set(type.names.en?.toLowerCase(), type)
    return map
  }, [types])

  const localized = useCallback(
    (canonical) => {
      if (!canonical) return canonical
      const type = byCanonical.get(canonical.trim().toLowerCase())
      return type?.names[lang] ?? type?.names.en ?? canonical
    },
    [byCanonical, lang],
  )

  const byCategory = useCallback(
    (category) => types.filter((type) => type.category === category),
    [types],
  )

  const addType = useCallback(
    async (payload) => {
      const created = await api.createPlantType(payload)
      setTypes((current) => [...current, created])
      return created
    },
    [],
  )

  const value = useMemo(
    () => ({ types, localized, byCategory, addType, refresh }),
    [types, localized, byCategory, addType, refresh],
  )

  return <PlantTypesContext.Provider value={value}>{children}</PlantTypesContext.Provider>
}

export function usePlantTypes() {
  return useContext(PlantTypesContext)
}
