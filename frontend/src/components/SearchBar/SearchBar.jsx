import { useRef, useState } from 'react'
import { geocodeLocation } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import styles from './SearchBar.module.css'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const { setSearchCenter } = useApp()
  const debounceRef = useRef(null)

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setResults([]); setOpen(false); return }
    // 600ms debounce — Nominatim ToS requirement
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await geocodeLocation(val)
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        setResults([])
      }
    }, 600)
  }

  function selectResult(item) {
    setQuery(item.display_name)
    setOpen(false)
    setResults([])
    setSearchCenter({ lat: parseFloat(item.lat), lon: parseFloat(item.lon), label: item.display_name })
  }

  return (
    <div className={styles.wrapper}>
      <input
        className={styles.input}
        type="text"
        placeholder="Search by city, state, or ZIP..."
        value={query}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && (
        <ul className={styles.dropdown}>
          {results.map((r, i) => (
            <li key={i} className={styles.item} onMouseDown={() => selectResult(r)}>
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
