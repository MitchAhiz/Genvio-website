require('dotenv').config()

const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const productRoutes = require('./routes/products')
const authRoutes = require('./routes/auth')

const app = express()
const PORT = process.env.PORT || 4000

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
app.use(express.json())
app.use(cookieParser())

app.use('/api', authRoutes)
app.use('/api', productRoutes)

app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
