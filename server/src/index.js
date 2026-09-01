require('dotenv').config()

const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const productRoutes = require('./routes/products')
const authRoutes = require('./routes/auth')

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
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
