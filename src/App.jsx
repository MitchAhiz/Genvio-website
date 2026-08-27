import { Routes, Route } from 'react-router-dom'
import { BagProvider } from './hooks/useBag'
import Layout from './layouts/Layout'
import CataloguePage from './pages/CataloguePage'
import ProductPage from './pages/ProductPage'
import BagPage from './pages/BagPage'

export default function App() {
  return (
    <BagProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<CataloguePage />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/bag" element={<BagPage />} />
        </Routes>
      </Layout>
    </BagProvider>
  )
}
