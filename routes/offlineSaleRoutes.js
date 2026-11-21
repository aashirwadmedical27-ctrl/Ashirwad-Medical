const express = require('express')
const mongoose = require('mongoose')
const OfflineSale = require('../models/OfflineSale')
const OfflineSaleCounter = require('../models/OfflineSaleCounter')
const Medicine = require('../models/Medicine')
const adjustInventoryStock = require('../utils/inventoryStock')
const { protect, requireAdmin } = require('../middleware/auth')

/* Non-medicinal model may be named differently in your project — load it safely */
let NonMedicinalItem = null
try {
  NonMedicinalItem = require('../models/NonMedicinalItem')
} catch (error) {
  console.warn('NonMedicinalItem model not found — non-medicinal stock will not be adjusted.')
}

const router = express.Router()

const validItemTypes = ['Medicine', 'NonMedicinalItem']
const validPaymentModes = ['Cash', 'UPI', 'Card', 'Other']

function modelFor(itemType) {
  if (itemType === 'Medicine') return Medicine
  if (itemType === 'NonMedicinalItem') return NonMedicinalItem
  return null
}

/* ---------- stock helper: medicine quantities are tablets, other items are units ---------- */
async function adjustStock(itemType, itemId, quantityDelta, { legacyStrips = false } = {}) {
  const Model = modelFor(itemType)
  if (!Model || !mongoose.isValidObjectId(itemId)) {
    throw new Error('Invalid inventory item')
  }
  return adjustInventoryStock(Model, itemType, itemId, quantityDelta, { legacyStrips })
}

/* ---------- bill number: OFF-YYYYMMDD-0001 ---------- */
function dayStamp(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function billNumberPattern(stamp) {
  return new RegExp(`^OFF-${stamp}-\\d{4,}$`)
}

async function latestBillSequence(stamp) {
  const latest = await OfflineSale.findOne({ billNumber: billNumberPattern(stamp) })
    .sort({ billNumber: -1 })
    .select('billNumber')
    .lean()
  const match = latest?.billNumber?.match(/-(\d+)$/)
  return match ? Number(match[1]) : 0
}

async function nextBillNumber(stamp) {
  const existingCounter = await OfflineSaleCounter.exists({ _id: stamp })

  if (!existingCounter) {
    const sequence = await latestBillSequence(stamp)
    try {
      await OfflineSaleCounter.updateOne(
        { _id: stamp },
        { $setOnInsert: { sequence } },
        { upsert: true }
      )
    } catch (error) {
      if (error?.code !== 11000) throw error
    }
  }

  const counter = await OfflineSaleCounter.findOneAndUpdate(
    { _id: stamp },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  )

  return `OFF-${stamp}-${String(counter.sequence).padStart(4, '0')}`
}

async function syncBillCounter(stamp) {
  const sequence = await latestBillSequence(stamp)
  await OfflineSaleCounter.updateOne(
    { _id: stamp },
    { $max: { sequence } },
    { upsert: true }
  )
}

/* ================================================================ */
/*  GET /api/offline-sales/summary   (must be before /:id)          */
/* ================================================================ */
router.get('/summary', protect, requireAdmin, async (req, res) => {
  try {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const aggregate = async (match) => {
      const rows = await OfflineSale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            bills: { $sum: 1 },
            totalMrp: { $sum: '$totalMrp' },
            soldAmount: { $sum: '$soldAmount' },
            discountAmount: { $sum: '$discountAmount' },
          },
        },
      ])

      const r = rows[0] || { bills: 0, totalMrp: 0, soldAmount: 0, discountAmount: 0 }
      return {
        bills: r.bills,
        totalMrp: Number(r.totalMrp.toFixed(2)),
        soldAmount: Number(r.soldAmount.toFixed(2)),
        discountAmount: Number(r.discountAmount.toFixed(2)),
        discountPercent:
          r.totalMrp > 0 ? Number(((r.discountAmount / r.totalMrp) * 100).toFixed(2)) : 0,
      }
    }

    const [today, month, allTime] = await Promise.all([
      aggregate({ createdAt: { $gte: startOfToday } }),
      aggregate({ createdAt: { $gte: startOfMonth } }),
      aggregate({}),
    ])

    return res.json({ summary: { today, month, allTime } })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to build offline sales summary',
    })
  }
})

/* ================================================================ */
/*  GET /api/offline-sales                                          */
/* ================================================================ */
router.get('/', protect, requireAdmin, async (req, res) => {
  try {
    const { from, to, q } = req.query
    const limit = Math.min(Number(req.query.limit) || 30, 200)

    const filter = {}

    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(from)
      if (to) {
        const end = new Date(to)
        end.setHours(23, 59, 59, 999)
        filter.createdAt.$lte = end
      }
    }

    if (q) {
      const rx = new RegExp(String(q).trim(), 'i')
      filter.$or = [
        { billNumber: rx },
        { customerName: rx },
        { customerPhone: rx },
        { 'items.name': rx },
      ]
    }

    const sales = await OfflineSale.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('soldBy', 'name email')

    return res.json({ count: sales.length, sales })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch offline bills',
    })
  }
})

/* ================================================================ */
/*  GET /api/offline-sales/:id                                      */
/* ================================================================ */
router.get('/:id', protect, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next()
    }

    const sale = await OfflineSale.findById(req.params.id).populate('soldBy', 'name email')
    if (!sale) return res.status(404).json({ message: 'Bill not found' })
    return res.json({ sale })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch bill' })
  }
})

/* ================================================================ */
/*  POST /api/offline-sales      →  create a shop bill              */
/* ================================================================ */
router.post('/', protect, requireAdmin, async (req, res) => {
  try {
    const { items, soldAmount, paymentMode, customerName, customerPhone, note } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Add at least one item to the bill' })
    }

    const sold = Number(soldAmount)
    if (!Number.isFinite(sold) || sold < 0) {
      return res.status(400).json({ message: 'Enter a valid final sold amount' })
    }

    /* ---------- validate + normalise items ---------- */
    const normalizedItems = []

    for (const item of items) {
      if (!validItemTypes.includes(item.itemType)) {
        return res.status(400).json({ message: 'Invalid item type in bill' })
      }

      const quantity = Number(item.quantity)

      if (!item.itemId || !item.name) {
        return res.status(400).json({ message: 'Each bill item needs itemId and name' })
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: `Quantity for ${item.name} must be a whole number` })
      }

      if (!mongoose.isValidObjectId(item.itemId)) {
        return res.status(400).json({ message: `Invalid inventory item for ${item.name}` })
      }

      const Model = modelFor(item.itemType)
      const inventoryItem = await Model.findById(item.itemId)
      if (!inventoryItem) {
        return res.status(404).json({ message: `${item.name} is no longer available` })
      }

      const isMedicine = item.itemType === 'Medicine'
      const tabletsPerStrip = isMedicine ? Number(inventoryItem.tabletsPerStrip) || 1 : undefined
      const mrp = isMedicine
        ? Number(inventoryItem.price || 0) / tabletsPerStrip
        : Number(inventoryItem.price || 0)
      const storedUnits = isMedicine ? Number(inventoryItem.totalMedicineQuantity) : 0
      const availableUnits = isMedicine
        ? storedUnits > 0 || Number(inventoryItem.stock || 0) === 0
          ? storedUnits
          : Number(inventoryItem.stock || 0) * tabletsPerStrip
        : Number(inventoryItem.stock || 0)

      if (availableUnits < quantity) {
        return res.status(409).json({ message: `Only ${availableUnits} unit(s) of ${inventoryItem.name} are in stock` })
      }

      normalizedItems.push({
        itemType: item.itemType,
        itemId: item.itemId,
        name: inventoryItem.name,
        quantity,
        mrp,
        lineMrp: Number((mrp * quantity).toFixed(2)),
        quantityUnit: isMedicine ? 'tablet' : 'item',
        ...(isMedicine ? { tabletsPerStrip } : {}),
        prescriptionRequired: Boolean(inventoryItem.prescriptionRequired),
      })
    }

    /* ---------- auto-computed percentages ---------- */
    const totalMrp = Number(
      normalizedItems.reduce((sum, i) => sum + i.lineMrp, 0).toFixed(2)
    )
    const discountAmount = Number((totalMrp - sold).toFixed(2))
    const discountPercent =
      totalMrp > 0 ? Number(((discountAmount / totalMrp) * 100).toFixed(2)) : 0

    /* ---------- create with unique bill number (retry on clash) ---------- */
    let sale = null
    let lastError = null
    const billStamp = dayStamp()

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        sale = await OfflineSale.create({
          billNumber: await nextBillNumber(billStamp),
          items: normalizedItems,
          totalMrp,
          soldAmount: sold,
          discountAmount,
          discountPercent,
          paymentMode: validPaymentModes.includes(paymentMode) ? paymentMode : 'Cash',
          customerName: String(customerName || '').trim(),
          customerPhone: String(customerPhone || '').trim(),
          note: String(note || '').trim(),
          soldBy: req.user.id,
          soldByName: req.user.name || '',
        })
        break
      } catch (error) {
        lastError = error
        if (error?.code !== 11000 || !error?.keyPattern?.billNumber) throw error
        await syncBillCounter(billStamp)
      }
    }

    if (!sale && lastError?.code === 11000) {
      return res.status(409).json({
        message: 'A bill number conflict occurred. The bill was not saved; please retry.',
      })
    }
    if (!sale) throw lastError || new Error('Failed to generate bill number')

    /* ---------- reduce stock; undo prior decrements and remove the bill on failure ---------- */
    const adjustedItems = []
    try {
      for (const item of normalizedItems) {
        await adjustStock(item.itemType, item.itemId, -item.quantity)
        adjustedItems.push(item)
      }
    } catch (stockError) {
      for (const item of adjustedItems.reverse()) {
        try {
          await adjustStock(item.itemType, item.itemId, item.quantity)
        } catch (rollbackError) {
          console.error('Offline sale stock rollback failed:', rollbackError.message)
        }
      }
      await OfflineSale.findByIdAndDelete(sale._id)
      return res.status(409).json({ message: stockError.message })
    }

    return res.status(201).json({
      message: `Bill ${sale.billNumber} saved successfully`,
      sale,
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to save offline bill',
    })
  }
})

/* ================================================================ */
/*  DELETE /api/offline-sales/:id   →  removes bill + restores stock */
/* ================================================================ */
router.delete('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const sale = await OfflineSale.findById(req.params.id)
    if (!sale) return res.status(404).json({ message: 'Bill not found' })

    for (const item of sale.items) {
      const isLegacyMedicine = item.itemType === 'Medicine' && item.quantityUnit !== 'tablet'
      await adjustStock(item.itemType, item.itemId, item.quantity, {
        legacyStrips: isLegacyMedicine,
      })
    }

    await OfflineSale.findByIdAndDelete(req.params.id)

    return res.json({ message: `Bill ${sale.billNumber} deleted`, sale })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to delete offline bill',
    })
  }
})


/* ================================================================ */
/*  GET /api/offline-sales/stats                                   */
/*  Query: from, to, groupBy=day|week|month, itemId               */
/* ================================================================ */
router.get('/stats', protect, requireAdmin, async (req, res) => {
  try {
    const { from, to, itemId } = req.query
    const groupBy = ['day', 'week', 'month'].includes(req.query.groupBy)
      ? req.query.groupBy
      : 'day'

    if (itemId && !mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({ message: 'Invalid item id' })
    }

    /* ---------- base match ---------- */
    const match = {}

    if (from || to) {
      match.createdAt = {}
      if (from) match.createdAt.$gte = new Date(from)
      if (to) {
        const end = new Date(to)
        end.setHours(23, 59, 59, 999)
        match.createdAt.$lte = end
      }
    }

    if (itemId) {
      match.items = { $elemMatch: { itemId: new mongoose.Types.ObjectId(itemId) } }
    }

    /* ---------- totals ---------- */
    const [totalsRow] = await OfflineSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          bills: { $sum: 1 },
          totalMrp: { $sum: '$totalMrp' },
          soldAmount: { $sum: '$soldAmount' },
          discountAmount: { $sum: '$discountAmount' },
        },
      },
    ])

    const totals = totalsRow
      ? {
          bills: totalsRow.bills,
          totalMrp: Number(totalsRow.totalMrp.toFixed(2)),
          soldAmount: Number(totalsRow.soldAmount.toFixed(2)),
          discountAmount: Number(totalsRow.discountAmount.toFixed(2)),
        }
      : { bills: 0, totalMrp: 0, soldAmount: 0, discountAmount: 0 }

    /* ---------- timeline ---------- */
    const dateFormat =
      groupBy === 'month'
        ? '%Y-%m'
        : groupBy === 'week'
        ? '%Y-W%V'
        : '%Y-%m-%d'

    const timelineRaw = await OfflineSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          bills: { $sum: 1 },
          totalMrp: { $sum: '$totalMrp' },
          soldAmount: { $sum: '$soldAmount' },
          discountAmount: { $sum: '$discountAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const timeline = timelineRaw.map((r) => ({
      period: r._id,
      bills: r.bills,
      totalMrp: Number(r.totalMrp.toFixed(2)),
      soldAmount: Number(r.soldAmount.toFixed(2)),
      discountAmount: Number(r.discountAmount.toFixed(2)),
    }))

    /* ---------- top items ---------- */
    const topPipeline = [
      { $match: match },
      { $unwind: '$items' },
    ]

    if (itemId) {
      topPipeline.push({
        $match: { 'items.itemId': new mongoose.Types.ObjectId(itemId) },
      })
    }

    topPipeline.push(
      {
        $group: {
          _id: {
            itemId: '$items.itemId',
            itemType: '$items.itemType',
          },
          name: { $first: '$items.name' },
          quantity: { $sum: '$items.quantity' },
          totalMrp: { $sum: '$items.lineMrp' },
          bills: { $sum: 1 },
        },
      },
      { $sort: { totalMrp: -1 } },
      { $limit: 25 }
    )

    const topRaw = await OfflineSale.aggregate(topPipeline)

    const topItems = topRaw.map((r) => ({
      itemId: r._id.itemId,
      itemType: r._id.itemType,
      name: r.name,
      quantity: r.quantity,
      totalMrp: Number(r.totalMrp.toFixed(2)),
      bills: r.bills,
    }))

    /* ---------- growth (vs previous equal-length period) ---------- */
    let growth = null

    if (from && to) {
      const fromDate = new Date(from)
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)

      const rangeMs = toDate.getTime() - fromDate.getTime()
      const prevFrom = new Date(fromDate.getTime() - rangeMs)
      const prevTo = new Date(fromDate.getTime() - 1)

      const [prevRow] = await OfflineSale.aggregate([
        { $match: { ...match, createdAt: { $gte: prevFrom, $lte: prevTo } } },
        {
          $group: {
            _id: null,
            bills: { $sum: 1 },
            soldAmount: { $sum: '$soldAmount' },
            totalMrp: { $sum: '$totalMrp' },
          },
        },
      ])

      const prev = prevRow
        ? {
            bills: prevRow.bills,
            soldAmount: Number(prevRow.soldAmount.toFixed(2)),
            totalMrp: Number(prevRow.totalMrp.toFixed(2)),
          }
        : { bills: 0, soldAmount: 0, totalMrp: 0 }

      const soldGrowth =
        prev.soldAmount > 0
          ? Number(
              (((totals.soldAmount - prev.soldAmount) / prev.soldAmount) * 100).toFixed(2)
            )
          : null

      const billGrowth =
        prev.bills > 0
          ? Number((((totals.bills - prev.bills) / prev.bills) * 100).toFixed(2))
          : null

      growth = {
        previous: prev,
        current: {
          bills: totals.bills,
          soldAmount: totals.soldAmount,
          totalMrp: totals.totalMrp,
        },
        soldGrowth,
        billGrowth,
      }
    }

    return res.json({
      stats: { totals, timeline, topItems, growth, groupBy },
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to build statistics',
    })
  }
})

module.exports = router