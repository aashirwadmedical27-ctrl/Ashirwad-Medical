const express = require('express')
const User = require('../models/User')
const { protect, requireAdmin } = require('../middleware/auth')

const router = express.Router()

/* ================================================================ */
/*  GET /api/birthdays?days=7                                       */
/*  Returns users whose birthday falls today or within N days.      */
/*  days=0 → today only. days=7 → today + next 7 days.              */
/* ================================================================ */
router.get('/', protect, requireAdmin, async (req, res) => {
  try {
    const daysAhead = Math.min(Math.max(Number(req.query.days) || 0, 0), 365)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    /* Only users who actually have a DOB set */
    const users = await User.find({ dateOfBirth: { $exists: true, $ne: null } })
      .select('name email phone role dateOfBirth')
      .lean()

    const items = []

    for (const u of users) {
      const dob = new Date(u.dateOfBirth)
      if (Number.isNaN(dob.getTime())) continue

      const bMonth = dob.getMonth()
      const bDay = dob.getDate()

      /* Next occurrence of this user's birthday */
      let occYear = todayStart.getFullYear()
      let occ = new Date(occYear, bMonth, bDay)
      if (occ < todayStart) {
        occYear += 1
        occ = new Date(occYear, bMonth, bDay)
      }

      const diffDays = Math.round((occ - todayStart) / (24 * 60 * 60 * 1000))
      if (diffDays < 0 || diffDays > daysAhead) continue

      items.push({
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        dateOfBirth: u.dateOfBirth,
        nextBirthday: occ.toISOString(),
        daysAway: diffDays,
        isToday: diffDays === 0,
        turningAge: occYear - dob.getFullYear(),
      })
    }

    /* Today first, then soonest first */
    items.sort((a, b) => a.daysAway - b.daysAway)

    const todayCount = items.filter((i) => i.isToday).length

    return res.json({
      count: items.length,
      todayCount,
      daysAhead,
      birthdays: items,
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch birthdays',
    })
  }
})

module.exports = router