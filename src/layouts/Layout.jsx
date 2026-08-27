import Navbar from '../components/Navbar'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <main>{children}</main>
    </div>
  )
}
