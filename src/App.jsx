import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link, useParams } from 'react-router-dom'
import { BagProvider } from './hooks/useBag'
import { SiteConfigProvider, useSiteConfig } from './hooks/useSiteConfig'
import { getProductBySlug } from './api/products'
import { productPath, sectionPath, getLastSection } from './sections'
import ShopLayout, { ShopIndexRedirect, SectionGuard } from './layouts/ShopLayout'
import LandingPage from './pages/LandingPage'
import CataloguePage from './pages/CataloguePage'
import ProductPage from './pages/ProductPage'
import BagPage from './pages/BagPage'
import WholesalePage from './pages/WholesalePage'
import MaintenancePage from './pages/MaintenancePage'
import AdminPage from './pages/AdminPage'
import AdminProducts from './pages/admin/AdminProducts'
import AdminOrders from './pages/admin/AdminOrders'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import AdminWholesale from './pages/admin/AdminWholesale'
import AdminSettings from './pages/admin/AdminSettings'

// Old /product/:slug links (shared on WhatsApp before the restructure) resolve
// to the product's own section.
function LegacyProductRedirect() {
  const { slug } = useParams()
  const [target, setTarget] = useState(null)
  useEffect(() => {
    getProductBySlug(slug)
      .then((p) => setTarget(productPath(p)))
      .catch(() => setTarget(sectionPath(getLastSection())))
  }, [slug])
  return target ? <Navigate to={target} replace /> : null
}

function NotFound() {
  return (
    <div className="min-h-screen bg-ground text-ink flex flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-2xl">Page not found</p>
      <Link to="/" className="mt-4 text-sm text-ink-soft underline underline-offset-4">
        Back to the front door
      </Link>
    </div>
  )
}

// Maintenance mode blocks every public route but never /admin — that's how
// the admin turns it back off.
function MaintenanceGate({ children }) {
  const { config, isAdmin } = useSiteConfig()
  if (!isAdmin && config?.maintenance_mode) return <MaintenancePage />
  return children
}

// Direct nav to /wholesale when the admin has hidden it.
function WholesaleGuard() {
  const { config } = useSiteConfig()
  if (config?.section_visibility?.wholesale === false) return <Navigate to="/" replace />
  return <WholesalePage />
}

export default function App() {
  return (
    <BagProvider>
    <SiteConfigProvider>
    <MaintenanceGate>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/wholesale" element={<WholesaleGuard />} />
        <Route path="/admin" element={<AdminPage />}>
          <Route index element={<Navigate to="/admin/products" replace />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="wholesale" element={<AdminWholesale />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="/shop" element={<ShopLayout />}>
          <Route index element={<ShopIndexRedirect />} />
          <Route path="bag" element={<BagPage />} />
          <Route path=":section" element={<SectionGuard />}>
            <Route index element={<CataloguePage />} />
            <Route path="product/:slug" element={<ProductPage />} />
          </Route>
        </Route>

        {/* Legacy routes from the single-catalogue era */}
        <Route path="/product/:slug" element={<LegacyProductRedirect />} />
        <Route path="/bag" element={<Navigate to="/shop/bag" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </MaintenanceGate>
    </SiteConfigProvider>
    </BagProvider>
  )
}
