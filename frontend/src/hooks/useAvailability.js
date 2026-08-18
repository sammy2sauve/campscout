import { useEffect, useState } from 'react'
import { fetchAvailability } from '../api/client.js'

export function useAvailability(id, start, end) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Both dates required — FastAPI returns 422 if either is missing
    if (!id || !start || !end) { setData(null); return }
    setLoading(true)
    fetchAvailability(id, start, end)
      .then(setData)
      .catch((err) => console.error('fetchAvailability failed:', err))
      .finally(() => setLoading(false))
  }, [id, start, end])

  return { data, loading }
}
