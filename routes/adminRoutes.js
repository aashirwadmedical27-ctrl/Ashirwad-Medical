const express = require('express');
const Order = require('../models/Order');
const { protect, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(requireAdmin);

router.get('/me', async (req, res) => {
  try {
    return res.json({
      admin: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Admin verification failed' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).populate('userId', 'name email');

    return res.json({
      count: orders.length,
      orders,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch admin orders' });
  }
});

module.exports = router;
