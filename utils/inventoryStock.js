async function adjustInventoryStock(Model, itemType, itemId, quantityDelta, { legacyStrips = false } = {}) {
  if (!Model || !itemId) throw new Error('Invalid inventory item')

  if (itemType !== 'Medicine' || legacyStrips) {
    const filter = { _id: itemId }
    if (quantityDelta < 0) filter.stock = { $gte: Math.abs(quantityDelta) }
    const updated = await Model.findOneAndUpdate(
      filter,
      { $inc: { stock: quantityDelta } },
      { new: true, runValidators: true }
    )
    if (!updated) throw new Error('Stock changed or is insufficient; refresh inventory and try again')
    return updated
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const medicine = await Model.findById(itemId).select('stock tabletsPerStrip totalMedicineQuantity')
    if (!medicine) throw new Error('Inventory item no longer exists')

    const tabletsPerStrip = Number(medicine.tabletsPerStrip) || 1
    const stock = Number(medicine.stock) || 0
    const storedUnits = Number(medicine.totalMedicineQuantity)
    const units = storedUnits > 0 || stock === 0
      ? storedUnits
      : stock * tabletsPerStrip
    const nextUnits = units + quantityDelta

    if (quantityDelta < 0 && units < Math.abs(quantityDelta)) {
      throw new Error(`Insufficient stock for ${medicine.name || 'medicine'}; ${units} tablet(s) available`)
    }

    const filter = { _id: itemId, stock: medicine.stock }
    if (medicine.totalMedicineQuantity == null || (storedUnits === 0 && stock > 0)) {
      filter.$or = [
        { totalMedicineQuantity: { $exists: false } },
        { totalMedicineQuantity: null },
        { totalMedicineQuantity: 0 },
      ]
    } else {
      filter.totalMedicineQuantity = medicine.totalMedicineQuantity
    }

    const updated = await Model.findOneAndUpdate(
      filter,
      {
        $set: {
          stock: Number((nextUnits / tabletsPerStrip).toFixed(8)),
          totalMedicineQuantity: nextUnits,
        },
      },
      { new: true, runValidators: true }
    )
    if (updated) return updated
  }

  throw new Error('Medicine stock changed; refresh inventory and try again')
}

module.exports = adjustInventoryStock