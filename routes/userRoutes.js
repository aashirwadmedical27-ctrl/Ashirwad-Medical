const express = require('express');
const User = require('../models/User');
const { protect, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function normalizeAddressInput(input = {}) {
  return {
    label: String(input.label || 'Home').trim() || 'Home',
    name: String(input.name || '').trim(),
    phone: String(input.phone || '').trim(),
    line1: String(input.line1 || input.home || '').trim(),
    line2: String(input.line2 || input.landmark || '').trim(),
    city: String(input.city || '').trim(),
    state: String(input.state || '').trim(),
    pincode: String(input.pincode || input.pinCode || '').trim(),
  };
}

function addressResponse(address, userName = '') {
  return {
    _id: address._id,
    label: address.label || 'Home',
    name: address.name || userName,
    phone: address.phone || '',
    line1: address.line1 || address.home || '',
    line2: address.line2 || address.landmark || '',
    city: address.city || '',
    state: address.state || '',
    pincode: address.pincode || address.pinCode || '',
  };
}

function validateAddress(address) {
  return ['name', 'phone', 'line1', 'city', 'pincode'].every((key) => address[key]);
}

/* ------------------------------------------------------------------ */
/*  ADMIN: list all users                                              */
/* ------------------------------------------------------------------ */
router.get('/', protect, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });

    return res.json({
      count: users.length,
      users: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        role: user.role,
        addresses: user.addresses,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch users',
    });
  }
});

/* ------------------------------------------------------------------ */
/*  ADMIN: current admin profile                                       */
/* ------------------------------------------------------------------ */
router.get('/me', protect, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        role: user.role,
        addresses: user.addresses,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to fetch user profile' });
  }
});

/* ------------------------------------------------------------------ */
/*  CURRENT USER: get own profile                                      */
/* ------------------------------------------------------------------ */
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        role: user.role,
        addresses: user.addresses,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch profile',
    });
  }
});

/* ------------------------------------------------------------------ */
/*  CURRENT USER: update own profile                                   */
/*  (used for the "complete profile" flow after Google sign-in)        */
/* ------------------------------------------------------------------ */
router.patch('/profile', protect, async (req, res) => {
  try {
    const { name, phone, gender, dateOfBirth } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    /* --- name --- */
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'Name cannot be empty' });
      }
      user.name = trimmed;
    }

    /* --- phone (unique, sparse) --- */
    if (phone !== undefined) {
      const trimmed = String(phone).trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'Phone cannot be empty' });
      }

      if (trimmed !== user.phone) {
        const existing = await User.findOne({
          phone: trimmed,
          _id: { $ne: user._id },
        });
        if (existing) {
          return res
            .status(400)
            .json({ message: 'This phone number is already registered' });
        }
      }

      user.phone = trimmed;
    }

    /* --- gender --- */
    if (gender !== undefined) {
      const allowed = ['Male', 'Female', 'Other'];
      if (!allowed.includes(gender)) {
        return res.status(400).json({ message: 'Invalid gender value' });
      }
      user.gender = gender;
    }

    /* --- date of birth --- */
    if (dateOfBirth !== undefined) {
      const d = new Date(dateOfBirth);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Invalid date of birth' });
      }
      if (d.getTime() > Date.now()) {
        return res
          .status(400)
          .json({ message: 'Date of birth cannot be in the future' });
      }
      user.dateOfBirth = d;
    }

    await user.save();

    return res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        role: user.role,
        addresses: user.addresses,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to update profile',
    });
  }
});

/* ------------------------------------------------------------------ */
/*  CURRENT USER: manage delivery addresses                            */
/* ------------------------------------------------------------------ */
router.get('/addresses', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name addresses');
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({
      addresses: user.addresses.map((address) => addressResponse(address, user.name)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch addresses' });
  }
});

router.post('/addresses', protect, async (req, res) => {
  try {
    const address = normalizeAddressInput(req.body);
    if (!validateAddress(address)) {
      return res.status(400).json({ message: 'Name, phone, address line, city, and pincode are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.addresses.push(address);
    await user.save();
    const savedAddress = user.addresses[user.addresses.length - 1];

    return res.status(201).json({
      message: 'Delivery address saved',
      address: addressResponse(savedAddress, user.name),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save address' });
  }
});

router.patch('/addresses/:addressId', protect, async (req, res) => {
  try {
    const address = normalizeAddressInput(req.body);
    if (!validateAddress(address)) {
      return res.status(400).json({ message: 'Name, phone, address line, city, and pincode are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const savedAddress = user.addresses.id(req.params.addressId);
    if (!savedAddress) return res.status(404).json({ message: 'Address not found' });

    Object.assign(savedAddress, address);
    await user.save();

    return res.json({
      message: 'Delivery address updated',
      address: addressResponse(savedAddress, user.name),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update address' });
  }
});

router.delete('/addresses/:addressId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ message: 'Address not found' });

    address.deleteOne();
    await user.save();

    return res.json({ message: 'Delivery address deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to delete address' });
  }
});

module.exports = router;