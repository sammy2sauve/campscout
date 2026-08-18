import { useEffect, useState } from 'react'
import { fetchWeather } from '../api/client.js'

export function useWeather(id) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) { setRows([]); return }
    setLoading(true)
    fetchWeather(id)
      .then(setRows)
      .catch((err) => console.error('fetchWeather failed:', err))
      .finally(() => setLoading(false))
  }, [id])

  return { rows, loading }
}
