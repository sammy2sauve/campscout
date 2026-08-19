import { useEffect, useRef, useState } from 'react'
import { fetchCampgrounds } from '../api/client.js'

export function useCampgrounds(bbox, filters, region) {
  const [campgrounds, setCampgrounds] = useState([])
  const [dataAsOf, setDataAsOf] = useState(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!bbox && !region) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const result = await fetchCampgrounds({ bbox, region, ...filters })
        setCampgrounds(result.items ?? [])
        setDataAsOf(result.data_as_of ?? null)
      } catch (err) {
        console.error('fetchCampgrounds failed:', err)
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timerRef.current)
  }, [bbox, filters, region])

  return { campgrounds, dataAsOf, loading }
}
