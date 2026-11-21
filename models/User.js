const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  label: {
    type: String,
    trim: true,
    default: 'Home',
  },

  name: {
    type: String,
    trim: true,
  },

  line1: {
    type: String,
    trim: true,
  },

  line2: {
    type: String,
    trim: true,
  },

  state: {
    type: String,
    trim: true,
  },

  pincode: {
    type: String,
    trim: true,
  },

  home: {
    type: String,
    trim: true,
  },

  landmark: {
    type: String,
    trim: true,
  },

  city: {
    type: String,
    trim: true,
  },

  pinCode: {
    type: String,
    trim: true,
  },

  phone: {
    type: String,
    trim: true,
  },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Required for normal email/password users,
    // but optional for Google-login users.
    password: {
      type: String,
      required: false,
      minlength: 6,
    },

    // Google account ID
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },

    // Optional because Google users don't need to provide
    // a phone number during registration.
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    addresses: {
      type: [addressSchema],
      default: [],
    },

    // Used for forgot-password functionality
    resetPasswordToken: {
      type: String,
      default: null,
      trim: true,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);