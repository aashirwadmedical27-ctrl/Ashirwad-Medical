const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ["Medicine", "NonMedicinalItem"],
      required: true,
    },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    quantityUnit: {
      type: String,
      enum: ['tablet', 'item'],
    },

    tabletsPerStrip: {
      type: Number,
      min: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    prescriptionRequired: {
      type: Boolean,
      default: false,
    },

    prescriptionImage: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const deliveryAddressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home' },
    name: { type: String, trim: true, required: true },
    phone: { type: String, trim: true, required: true },
    line1: { type: String, trim: true, required: true },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, required: true },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderDate: {
      type: Date,
      default: Date.now,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return items.length > 0;
        },
        message: "Order must contain at least one item",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    prescriptionImage: {
      type: String,
      trim: true,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    freeItem: {
      itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "NonMedicinalItem",
      },

      name: {
        type: String,
        trim: true,
      },

      price: {
        type: Number,
        min: 0,
      },
    },

    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },

    paymentMode: {
      type: String,
      enum: ["online", "Cash on Delivery"],
      required: true,
    },

    orderStatus: {
      type: String,
      enum: [
        "Placed",
        "Confirmed",
        "Delivered",
        "Cancelled",
      ],
      default: "Placed",
    },

    deliveryAddressId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    deliveryAddress: {
      type: deliveryAddressSchema,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Useful indexes
orderSchema.index({
  userId: 1,
  orderDate: -1,
});

orderSchema.index({
  orderDate: -1,
});


orderSchema.index({
  paymentStatus: 1,
  orderDate: -1,
});

module.exports = mongoose.model("Order", orderSchema);