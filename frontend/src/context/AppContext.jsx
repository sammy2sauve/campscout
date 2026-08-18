import { createContext, useContext, useRef, useState } from 'react'

const AppContext = createContext(null)

const defaultFilters = {
  has_electricity: false,
  has_showers: false,
  has_toilets: false,
  has_drinking_water: false,
  pets_allowed: false,
  wildlife_tags: [],
  terrain_tags: [],
  availStart: null,
  availEnd: null,
}

export function AppProvider({ children }) {
  const [selectedId, setSelectedId] = useState(null)
  const [filters, setFilters] = useState(defaultFilters)
  const [searchCenter, setSearchCenter] = useState(null)
  // mapRef is set by MapView on mount so SearchBar can call flyTo
  const mapRef = useRef(null)

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function toggleTag(listKey, tag) {
    setFilters((prev) => {
      const current = prev[listKey]
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag]
      return { ...prev, [listKey]: next }
    })
  }

  function clearFilters() {
    setFilters(defaultFilters)
  }

  return (
    <AppContext.Provider value={{
      selectedId, setSelectedId,
      filters, setFilter, toggleTag, clearFilters,
      searchCenter, setSearchCenter,
      mapRef,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
