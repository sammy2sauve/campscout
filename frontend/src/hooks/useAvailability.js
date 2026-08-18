import { useEffect, useState } from 'react'
import { fetchAvailability } from '../api/client.js'

export function useAvailability(id, start, end) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Both dates required — FastAPI returns 422 if either is missing
    if (!id || !start || !end) { setRows([]); return }
    setLoading(true)
    fetchAvailability(id, start, end)
      .then(setRows)
      .catch((err) => console.error('fetchAvailability failed:', err))
      .finally(() => setLoading(false))
  }, [id, start, end])

  return { rows, loading }
}
