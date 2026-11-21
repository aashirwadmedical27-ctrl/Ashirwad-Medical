const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    minAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    maxAmount: {
      type: Number,
      min: 0,
    },

    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },

    freeItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NonMedicinalItem",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
  }
);

const settingsSchema = new mongoose.Schema(
  {
    homepageOffer: {
      type: String,
      trim: true,
      default: "",
    },

    offers: {
      type: [offerSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Settings", settingsSchema);
