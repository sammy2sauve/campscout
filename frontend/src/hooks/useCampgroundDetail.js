import { useEffect, useState } from 'react'
import { fetchCampgroundDetail } from '../api/client.js'

export function useCampgroundDetail(id) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) { setDetail(null); return }
    setLoading(true)
    fetchCampgroundDetail(id)
      .then(setDetail)
      .catch((err) => console.error('fetchCampgroundDetail failed:', err))
      .finally(() => setLoading(false))
  }, [id])

  return { detail, loading }
}
