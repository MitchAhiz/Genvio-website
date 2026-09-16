require('dotenv').config()

const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const productRoutes = require('./routes/products')
const authRoutes = require('./routes/auth')
const wholesaleRoutes = require('./routes/wholesale')
const customerRoutes = require('./routes/customers')
const orderRoutes = require('./routes/orders')
const configRoutes = require('./routes/config')
const subcategoryRoutes = require('./routes/subcategories')
const activityRoutes = require('./routes/activity')
const analyticsRoutes = require('./routes/analytics')

const app = express()
const PORT = process.env.PORT || 4000

// Behind Render's proxy, so req.ip (used by the rate limiter) is the client's.
app.set('trust proxy', 1)

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://genvio-website.vercel.app',
]
if (process.env.CORS_ORIGIN) ALLOWED_ORIGINS.push(process.env.CORS_ORIGIN)

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.use('/api', authRoutes)
app.use('/api', productRoutes)
app.use('/api', wholesaleRoutes)
app.use('/api', customerRoutes)
app.use('/api', orderRoutes)
app.use('/api', configRoutes)
app.use('/api', subcategoryRoutes)
app.use('/api', activityRoutes)
app.use('/api', analyticsRoutes)

app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
