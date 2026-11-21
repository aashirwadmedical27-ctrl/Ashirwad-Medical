import { createContext, useContext, useEffect, useState } from 'react'

const CART_STORAGE_KEY = 'ashirvadMedicalCart'
const StoreContext = createContext(null)

function readCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

export function StoreProvider({ children }) {
  const [cart, setCart] = useState(readCart)
  const [prescriptions, setPrescriptions] = useState({})

  useEffect(() => {
    try {
      if (cart.length) localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
      else localStorage.removeItem(CART_STORAGE_KEY)
    } catch {
      // Cart remains usable in memory if browser storage is unavailable.
    }
  }, [cart])

  return (
    <StoreContext.Provider value={{ cart, setCart, prescriptions, setPrescriptions }}>
      {children}
    </StoreContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used within StoreProvider')
  return store
}