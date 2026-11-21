import { useEffect, useState } from 'react'

/** Turns a stored photo (Blob) into a URL an <img> can show, and cleans it up afterwards. */
export function useObjectURL(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
