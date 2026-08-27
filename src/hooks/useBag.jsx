import { createContext, useContext, useState, useCallback } from 'react'

const BagContext = createContext()

export function BagProvider({ children }) {
  const [items, setItems] = useState([])

  const addItem = useCallback(({ product, colour, size, qty }) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (i) => i.productId === product.id && i.colour === colour && i.size === size
      )
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + qty }
        return next
      }
      return [
        ...prev,
        {
          id: `${product.id}-${colour}-${size}`,
          productId: product.id,
          name: product.name,
          brand: product.brand,
          image: product.variants.find((v) => v.colour === colour)?.image || product.images[0],
          colour,
          size,
          qty,
          unitPrice: product.price,
        },
      ]
    })
  }, [])

  const updateQty = useCallback((itemId, qty) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, qty } : i))
      )
    }
  }, [])

  const removeItem = useCallback((itemId) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }, [])

  const clearBag = useCallback(() => setItems([]), [])

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0)
  const total = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)

  return (
    <BagContext.Provider value={{ items, addItem, updateQty, removeItem, clearBag, itemCount, total }}>
      {children}
    </BagContext.Provider>
  )
}

export function useBag() {
  const ctx = useContext(BagContext)
  if (!ctx) throw new Error('useBag must be used within BagProvider')
  return ctx
}
