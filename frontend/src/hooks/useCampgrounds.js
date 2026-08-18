import { useEffect, useRef, useState } from 'react'
import { fetchCampgrounds } from '../api/client.js'

export function useCampgrounds(bbox, filters) {
  const [campgrounds, setCampgrounds] = useState([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!bbox) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const result = await fetchCampgrounds({ bbox, ...filters })
        setCampgrounds(result.items ?? [])
      } catch (err) {
        console.error('fetchCampgrounds failed:', err)
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timerRef.current)
  }, [bbox, filters])

  return { campgrounds, loading }
}
