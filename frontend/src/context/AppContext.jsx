import { createContext, useContext, useEffect, useRef, useState } from 'react'

const AppContext = createContext(null)

const defaultFilters = {
  has_electricity: false,
  has_showers: false,
  has_toilets: false,
  has_drinking_water: false,
  pets_allowed: false,
  wildlife_tags: [],
  terrain_tags: [],
  activity_tags: [],
  availStart: null,
  availEnd: null,
}

function getRegionFromUrl() {
  return new URLSearchParams(window.location.search).get('region') || null
}

function setRegionInUrl(regionId) {
  const params = new URLSearchParams(window.location.search)
  if (regionId) {
    params.set('region', regionId)
  } else {
    params.delete('region')
  }
  const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`
  window.history.pushState({}, '', newUrl)
}

export function AppProvider({ children }) {
  const [selectedId, setSelectedId] = useState(null)
  const [filters, setFilters] = useState(defaultFilters)
  const [searchCenter, setSearchCenter] = useState(null)
  const [selectedRegion, setSelectedRegionState] = useState(getRegionFromUrl)
  // mapRef is set by MapView on mount so SearchBar can call flyTo
  const mapRef = useRef(null)

  // Sync region to URL whenever it changes
  function setSelectedRegion(regionId) {
    setSelectedRegionState(regionId)
    setRegionInUrl(regionId)
  }

  // Handle browser back/forward navigation
  useEffect(() => {
    function onPopState() {
      setSelectedRegionState(getRegionFromUrl())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

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
      selectedRegion, setSelectedRegion,
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
