import { useEffect, useState } from 'react'
import { fetchAlerts } from '../api/client.js'

export function useAlerts(id) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) { setAlerts([]); return }
    setLoading(true)
    fetchAlerts(id)
      .then(setAlerts)
      .catch((err) => console.error('fetchAlerts failed:', err))
      .finally(() => setLoading(false))
  }, [id])

  return { alerts, loading }
}
