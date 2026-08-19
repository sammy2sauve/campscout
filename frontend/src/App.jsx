import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { MapView } from './components/MapView/MapView.jsx'
import { SearchBar } from './components/SearchBar/SearchBar.jsx'
import { FilterPanel } from './components/FilterPanel/FilterPanel.jsx'
import { DetailPanel } from './components/DetailPanel/DetailPanel.jsx'
import { RegionPicker } from './components/RegionPicker/RegionPicker.jsx'
import { useCampgrounds } from './hooks/useCampgrounds.js'
import { fetchRegions } from './api/client.js'
import styles from './App.module.css'

function Dashboard({ regionData }) {
  const [bbox, setBbox] = useState(null)
  const { filters, selectedRegion } = useApp()
  const { campgrounds, dataAsOf, loading } = useCampgrounds(bbox, filters, selectedRegion)

  return (
    <div className={styles.layout}>
      <header className={styles.topBar}>
        <span className={styles.logo}>CampScout</span>
        <SearchBar />
        {loading && <span className={styles.loadingDot} title="Loading..." />}
      </header>

      <div className={styles.body}>
        <FilterPanel />
        <MapView
          campgrounds={campgrounds}
          dataAsOf={dataAsOf}
          onBboxChange={setBbox}
          regionData={regionData}
        />
        <DetailPanel />
      </div>
    </div>
  )
}

function AppInner() {
  const { selectedRegion } = useApp()
  const [allRegions, setAllRegions] = useState([])

  useEffect(() => {
    fetchRegions()
      .then(setAllRegions)
      .catch((err) => console.error('fetchRegions failed:', err))
  }, [])

  const regionData = allRegions.find((r) => r.id === selectedRegion) ?? null

  if (!selectedRegion) {
    return <RegionPicker />
  }

  return <Dashboard regionData={regionData} />
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
