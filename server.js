require('dotenv').config()

const cors = require('cors')
const express = require('express')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('./models/User')
const authRoutes = require('./routes/authRoutes')
const userRoutes = require('./routes/userRoutes')
const medicineRoutes = require('./routes/medicineRoutes')
const nonMedicinalRoutes = require('./routes/nonMedicinalRoutes')
const orderRoutes = require('./routes/orderRoutes')
const adminSettingsRoutes = require('./routes/adminSettingsRoutes')
const adminRoutes = require('./routes/adminRoutes')
const { protect } = require('./middleware/auth')
const offlineSaleRoutes = require('./routes/offlineSaleRoutes')
const birthdayRoutes = require('./routes/birthdayRoutes')

const app = express()
const port = Number(process.env.PORT) || 5000

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
	res.json({
		status: 'ok',
		service: 'medical-backend',
		database: mongoose.connection.readyState === 1 ? 'connected' : 'not connected',
	})
})

app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/medicine', medicineRoutes)
app.use('/api/nonmedicinal', nonMedicinalRoutes)
app.use('/api/non-medicinal', nonMedicinalRoutes)
app.use('/api/offline-sales', offlineSaleRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/admin', adminSettingsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/birthdays', birthdayRoutes) 


app.get('/api/profile', protect, (req, res) => {
	res.json({
		message: 'Profile access successful',
		user: req.user,
	})
})

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' })
})

app.use((error, req, res, next) => {
	console.error(error)
	res.status(500).json({ error: 'Internal server error' })
})

async function ensureRealAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminPhone = process.env.ADMIN_PHONE || '9999999999'

  if (!adminEmail || !adminPassword) {
    console.log('Admin credentials are not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in Backend/.env to enable a real admin account.')
    return
  }

  try {
    const existingAdmin = await User.findOne({ email: adminEmail })

    if (existingAdmin) {
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin'
        await existingAdmin.save()
      }
      return
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    await User.create({
      name: 'Admin User',
      email: adminEmail,
      phone: adminPhone,
      password: hashedPassword,
      role: 'admin',
    })

    console.log('Real admin account ensured for:', adminEmail)
  } catch (error) {
    console.error('Admin setup failed:', error.message)
  }
}

async function startServer() {
	if (process.env.MONGO_URI) {
		try {
			await mongoose.connect(process.env.MONGO_URI)
			console.log('Connected to MongoDB')
			await ensureRealAdmin()
		} catch (error) {
			console.error('MongoDB connection failed:', error.message)
			process.exitCode = 1
			return
		}
	}

	app.listen(port, () => {
		console.log(`Backend running at http://localhost:${port}`)
	})
}

startServer()
