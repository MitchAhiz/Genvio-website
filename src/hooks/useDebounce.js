import { useEffect, useState } from 'react'

// useDebounce('abc', 300) -> value updates 300ms after the input stops changing.
export function useDebounce(value, delayMs) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
