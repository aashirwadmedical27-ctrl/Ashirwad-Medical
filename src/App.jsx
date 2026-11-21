import AppRoutes from './routes'
import './App.css'
import { StoreProvider } from './customer/StoreContext'

function App() {
  return (
    <div>
      <StoreProvider>
        <AppRoutes />
      </StoreProvider>
    </div>
  )
}

export default App
