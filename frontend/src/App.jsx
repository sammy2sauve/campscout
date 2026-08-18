import { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { MapView } from './components/MapView/MapView.jsx'
import { SearchBar } from './components/SearchBar/SearchBar.jsx'
import { FilterPanel } from './components/FilterPanel/FilterPanel.jsx'
import { DetailPanel } from './components/DetailPanel/DetailPanel.jsx'
import { useCampgrounds } from './hooks/useCampgrounds.js'
import styles from './App.module.css'

function Dashboard() {
  const [bbox, setBbox] = useState(null)
  const { filters } = useApp()
  const { campgrounds, dataAsOf, loading } = useCampgrounds(bbox, filters)

  return (
    <div className={styles.layout}>
      <header className={styles.topBar}>
        <span className={styles.logo}>CampScout</span>
        <SearchBar />
        {loading && <span className={styles.loadingDot} title="Loading..." />}
      </header>

      <div className={styles.body}>
        <FilterPanel />
        <MapView campgrounds={campgrounds} dataAsOf={dataAsOf} onBboxChange={setBbox} />
        <DetailPanel />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  )
}
