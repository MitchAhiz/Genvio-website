import { Routes, Route } from 'react-router-dom'
import { BagProvider } from './hooks/useBag'
import Layout from './layouts/Layout'
import CataloguePage from './pages/CataloguePage'
import ProductPage from './pages/ProductPage'
import BagPage from './pages/BagPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <BagProvider>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<CataloguePage />} />
              <Route path="/product/:slug" element={<ProductPage />} />
              <Route path="/bag" element={<BagPage />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </BagProvider>
  )
}
