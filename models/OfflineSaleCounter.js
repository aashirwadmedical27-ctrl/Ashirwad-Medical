const mongoose = require('mongoose')

const offlineSaleCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, min: 0 },
  },
  { versionKey: false }
)

module.exports = mongoose.model('OfflineSaleCounter', offlineSaleCounterSchema)