const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    manufacturer: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      required: true,
      trim: true,
    },

    cloudinaryPublicId: {
      type: String,
      default: '',
      trim: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    description: {
      type: String,
      trim: true,
    },

    tabletsPerStrip: {
      type: Number,
      required: true,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    totalMedicineQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    prescriptionRequired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

medicineSchema.pre('save', function () {
  this.totalMedicineQuantity =
    Number(this.stock || 0) * Number(this.tabletsPerStrip || 0);
});

medicineSchema.pre('findOneAndUpdate', async function () {
  const updates = this.getUpdate() || {};
  const currentMedicine = await this.model
    .findOne(this.getQuery())
    .select('stock tabletsPerStrip')
    .lean();

  if (!currentMedicine) return;

  const setUpdates = updates.$set || {};
  const incrementUpdates = updates.$inc || {};
  const hasExplicitTotalUpdate =
    updates.totalMedicineQuantity !== undefined ||
    setUpdates.totalMedicineQuantity !== undefined ||
    incrementUpdates.totalMedicineQuantity !== undefined;

  if (hasExplicitTotalUpdate) return;

  const stock = Number(
    setUpdates.stock ?? updates.stock ?? currentMedicine.stock ?? 0
  ) + Number(incrementUpdates.stock || 0);
  const tabletsPerStrip = Number(
    setUpdates.tabletsPerStrip ?? updates.tabletsPerStrip ?? currentMedicine.tabletsPerStrip ?? 0
  ) + Number(incrementUpdates.tabletsPerStrip || 0);

  if (Object.keys(updates).some((key) => key.startsWith('$'))) {
    this.setUpdate({
      ...updates,
      $set: {
        ...setUpdates,
        totalMedicineQuantity: stock * tabletsPerStrip,
      },
    });
    return;
  }

  this.setUpdate({
    $set: {
      ...updates,
      totalMedicineQuantity: stock * tabletsPerStrip,
    },
  });
});

module.exports = mongoose.model("Medicine", medicineSchema);
