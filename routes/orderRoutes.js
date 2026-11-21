const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Medicine = require('../models/Medicine');
const NonMedicinalItem = require('../models/NonMedicinalItem');
const adjustInventoryStock = require('../utils/inventoryStock');
const { protect, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const validPaymentModes = ['online', 'Cash on Delivery'];

const validItemTypes = ['Medicine', 'NonMedicinalItem'];

router.get('/', protect, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).populate('userId', 'name email');

    return res.json({
      count: orders.length,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch orders',
    });
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });

    return res.json({
      count: orders.length,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch your orders',
    });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role !== 'admin' && order.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You cannot access this order' });
    }

    return res.json({ order });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch order',
    });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const {
      items,
      paymentMode,
      deliveryAddressId,
      prescriptionImage,
      discountAmount = 0,
      freeItem,
      offerId,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required to place an order' });
    }

    if (!paymentMode) {
      return res.status(400).json({ message: 'Payment mode is required' });
    }

    if (!validPaymentModes.includes(paymentMode)) {
      return res.status(400).json({ message: 'Select a valid payment mode' });
    }

    if (!deliveryAddressId) {
      return res.status(400).json({ message: 'Delivery address is required' });
    }

    if (!mongoose.isValidObjectId(deliveryAddressId)) {
      return res.status(400).json({ message: 'Select a valid delivery address' });
    }

    const user = await User.findById(req.user.id).select('addresses name');
    const savedAddress = user?.addresses.id(deliveryAddressId);
    if (!savedAddress) {
      return res.status(400).json({ message: 'The selected delivery address was not found. Please select or add an address.' });
    }

    const deliveryAddress = {
      label: savedAddress.label || 'Home',
      name: savedAddress.name || user.name,
      phone: savedAddress.phone || '',
      line1: savedAddress.line1 || savedAddress.home || '',
      line2: savedAddress.line2 || savedAddress.landmark || '',
      city: savedAddress.city || '',
      state: savedAddress.state || '',
      pincode: savedAddress.pincode || savedAddress.pinCode || '',
    };

    const normalizedItems = [];

    for (const item of items) {
      if (!validItemTypes.includes(item.itemType)) {
        return res.status(400).json({ message: 'Invalid item type in order' });
      }

      const quantity = Number(item.quantity);
      if (!mongoose.isValidObjectId(item.itemId) || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Each order item needs a valid item and positive whole-number quantity' });
      }

      const isMedicine = item.itemType === 'Medicine';
      const Model = isMedicine ? Medicine : NonMedicinalItem;
      const inventoryItem = await Model.findById(item.itemId);
      if (!inventoryItem) {
        return res.status(404).json({ message: 'An item in your order is no longer available' });
      }

      const tabletsPerStrip = isMedicine ? Number(inventoryItem.tabletsPerStrip) || 1 : undefined;
      const storedTabletUnits = isMedicine ? Number(inventoryItem.totalMedicineQuantity) : 0;
      const stripStock = Number(inventoryItem.stock) || 0;
      const availableQuantity = isMedicine
        ? storedTabletUnits > 0 || stripStock === 0
          ? storedTabletUnits
          : stripStock * tabletsPerStrip
        : stripStock;

      if (availableQuantity < quantity) {
        return res.status(409).json({
          message: `Only ${availableQuantity} ${isMedicine ? 'tablet(s)' : 'unit(s)'} of ${inventoryItem.name} are available`,
        });
      }

      const unitPrice = isMedicine
        ? Number(inventoryItem.price || 0) / tabletsPerStrip
        : Number(inventoryItem.price || 0);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return res.status(400).json({ message: `${inventoryItem.name} does not have a valid price` });
      }

      const prescriptionRequired = isMedicine && Boolean(inventoryItem.prescriptionRequired);
      normalizedItems.push({
        itemType: item.itemType,
        itemId: inventoryItem._id,
        name: inventoryItem.name,
        quantity,
        unitPrice,
        quantityUnit: isMedicine ? 'tablet' : 'item',
        ...(isMedicine ? { tabletsPerStrip } : {}),
        prescriptionRequired,
        prescriptionImage: typeof item.prescriptionImage === 'string'
          ? item.prescriptionImage.trim()
          : '',
      });
    }

    const prescriptionItems = normalizedItems.filter((item) => item.prescriptionRequired);

    if (prescriptionItems.length === 1 && !prescriptionItems[0].prescriptionImage && prescriptionImage) {
      prescriptionItems[0].prescriptionImage = String(prescriptionImage).trim();
    }

    const missingPrescription = prescriptionItems.some((item) => !item.prescriptionImage);

    if (missingPrescription) {
      return res.status(400).json({
        message: prescriptionItems.length > 1
          ? 'A separate prescription image is required for each prescription-based medicine'
          : 'Prescription image is required for prescription-based items',
      });
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountedValue = Math.min(Math.max(Number(discountAmount) || 0, 0), subtotal);
    const totalAmount = Math.max(subtotal - discountedValue, 0);

    const order = await Order.create({
      userId: req.user.id,
      items: normalizedItems,
      subtotal,
      prescriptionImage: prescriptionImage || undefined,
      discountAmount: discountedValue,
      freeItem: freeItem || undefined,
      offerId: offerId || undefined,
      totalAmount,
      paymentStatus: 'Pending',
      paymentMode,
      deliveryAddressId,
      deliveryAddress,
    });

    const adjustedItems = [];
    try {
      for (const item of normalizedItems) {
        const Model = item.itemType === 'Medicine' ? Medicine : NonMedicinalItem;
        await adjustInventoryStock(Model, item.itemType, item.itemId, -item.quantity);
        adjustedItems.push(item);
      }
    } catch (stockError) {
      for (const item of adjustedItems.reverse()) {
        try {
          const Model = item.itemType === 'Medicine' ? Medicine : NonMedicinalItem;
          await adjustInventoryStock(Model, item.itemType, item.itemId, item.quantity);
        } catch (rollbackError) {
          console.error('Order stock rollback failed:', rollbackError.message);
        }
      }
      await Order.findByIdAndDelete(order._id);
      return res.status(409).json({ message: stockError.message || 'Inventory changed; refresh and try again' });
    }

    return res.status(201).json({
      message: 'Order placed successfully',
      order,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to place order',
    });
  }
});

router.patch('/:id/status', protect, requireAdmin, async (req, res) => {
  try {
    const { orderStatus, paymentStatus } = req.body;

    if (!orderStatus && !paymentStatus) {
      return res.status(400).json({
        message: 'Provide at least one field to update: orderStatus or paymentStatus',
      });
    }

    const updates = {};

    if (orderStatus) updates.orderStatus = orderStatus;
    if (paymentStatus) updates.paymentStatus = paymentStatus;

    const order = await Order.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json({
      message: 'Order status updated successfully',
      order,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to update order status',
    });
  }
});

module.exports = router;
