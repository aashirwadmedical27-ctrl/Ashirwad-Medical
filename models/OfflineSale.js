const mongoose = require('mongoose')

const offlineSaleItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ['Medicine', 'NonMedicinalItem'],
      required: true,
    },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    mrp: { type: Number, required: true, min: 0 },      // unit MRP at sale time
    lineMrp: { type: Number, required: true, min: 0 },  // mrp * quantity
    quantityUnit: { type: String, enum: ['tablet', 'item'], default: 'item' },
    tabletsPerStrip: { type: Number, min: 1 },
    prescriptionRequired: { type: Boolean, default: false },
  },
  { _id: false }
)

const offlineSaleSchema = new mongoose.Schema(
  {
    billNumber: { type: String, required: true, unique: true, index: true },

    items: {
      type: [offlineSaleItemSchema],
      validate: [(v) => v.length > 0, 'At least one item is required'],
    },

    totalMrp: { type: Number, required: true, min: 0 },      // sum of lineMrp
    soldAmount: { type: Number, required: true, min: 0 },    // what the admin actually charged
    discountAmount: { type: Number, required: true },        // totalMrp - soldAmount
    discountPercent: { type: Number, required: true },       // discountAmount / totalMrp * 100

    paymentMode: {
      type: String,
      enum: ['Cash', 'UPI', 'Card', 'Other'],
      default: 'Cash',
    },

    customerName: { type: String, trim: true, default: '' },
    customerPhone: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },

    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    soldByName: { type: String, default: '' },
  },
  { timestamps: true }
)

offlineSaleSchema.index({ createdAt: -1 })

module.exports = mongoose.model('OfflineSale', offlineSaleSchema)