const express = require('express');
const cloudinary = require('cloudinary').v2;
const NonMedicinalItem = require('../models/NonMedicinalItem');
const { protect, requireAdmin } = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();

const allowedFields = ['name', 'image', 'cloudinaryPublicId', 'uploadedBy', 'description', 'price', 'stock', 'expiryDate'];

router.get('/', async (req, res) => {
  try {
    const items = await NonMedicinalItem.find().sort({ createdAt: -1 });
    return res.json({
      count: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch non-medicinal items',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await NonMedicinalItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Non-medicinal item not found' });
    }

    return res.json({ item });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch item',
    });
  }
});

router.post('/', protect, requireAdmin, async (req, res) => {
  try {
    const { name, image, cloudinaryPublicId, uploadedBy, description, price, stock, expiryDate } = req.body;

    if (!name || !image) {
      return res.status(400).json({
        message: 'Item name and image URL are required',
      });
    }

    const item = await NonMedicinalItem.create({
      name,
      image,
      cloudinaryPublicId: cloudinaryPublicId || '',
      uploadedBy: uploadedBy || null,
      description,
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      expiryDate,
    });

    return res.status(201).json({
      message: 'Non-medicinal item created successfully',
      item,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to create non-medicinal item',
    });
  }
});

router.patch('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const existingItem = await NonMedicinalItem.findById(req.params.id);

    if (!existingItem) {
      return res.status(404).json({ message: 'Non-medicinal item not found' });
    }

    const isReplacingImage =
      req.body.image !== undefined &&
      req.body.image &&
      req.body.image !== existingItem.image;

    const isReplacingPublicId =
      req.body.cloudinaryPublicId !== undefined &&
      req.body.cloudinaryPublicId &&
      req.body.cloudinaryPublicId !== existingItem.cloudinaryPublicId;

    if ((isReplacingImage || isReplacingPublicId) && existingItem.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(existingItem.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.warn('Cloudinary replace warning:', cloudinaryError.message);
      }
    }

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'price' || field === 'stock') {
          updates[field] = Number(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'No valid non-medicinal fields were provided for update',
      });
    }

    const item = await NonMedicinalItem.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    return res.json({
      message: 'Non-medicinal item updated successfully',
      item,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to update non-medicinal item',
    });
  }
});

router.post('/:id/stock', protect, requireAdmin, async (req, res) => {
  try {
    const { direction } = req.body;
    const quantity = Number(req.body.quantity);

    if (!['add', 'remove'].includes(direction)) {
      return res.status(400).json({ message: 'Direction must be add or remove' });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'Enter a positive whole number of items' });
    }

    const filter = { _id: req.params.id };
    const amount = direction === 'add' ? quantity : -quantity;

    if (direction === 'remove') {
      filter.stock = { $gte: quantity };
    }

    const item = await NonMedicinalItem.findOneAndUpdate(
      filter,
      { $inc: { stock: amount } },
      { new: true, runValidators: true }
    );

    if (!item) {
      const exists = await NonMedicinalItem.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({
        message: exists
          ? `Cannot remove ${quantity} item(s); stock is insufficient`
          : 'Non-medicinal item not found',
      });
    }

    return res.json({
      message: `${quantity} item(s) ${direction === 'add' ? 'added' : 'removed'}`,
      item,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to adjust non-medicinal stock',
    });
  }
});

router.put('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const existingItem = await NonMedicinalItem.findById(req.params.id);

    if (!existingItem) {
      return res.status(404).json({ message: 'Non-medicinal item not found' });
    }

    const { name, image, cloudinaryPublicId, uploadedBy, description, price, stock, expiryDate } = req.body;

    if (!name || !image) {
      return res.status(400).json({
        message: 'Item name and image URL are required',
      });
    }

    const isReplacingImage = image && image !== existingItem.image;
    const isReplacingPublicId = cloudinaryPublicId && cloudinaryPublicId !== existingItem.cloudinaryPublicId;

    if ((isReplacingImage || isReplacingPublicId) && existingItem.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(existingItem.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.warn('Cloudinary replace warning:', cloudinaryError.message);
      }
    }

    const item = await NonMedicinalItem.findByIdAndUpdate(
      req.params.id,
      {
        name,
        image,
        cloudinaryPublicId: cloudinaryPublicId || '',
        uploadedBy: uploadedBy || null,
        description,
        price: Number(price) || 0,
        stock: Number(stock) || 0,
        expiryDate,
      },
      { new: true, runValidators: true }
    );

    return res.json({
      message: 'Non-medicinal item updated successfully',
      item,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to update non-medicinal item',
    });
  }
});

router.delete('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const item = await NonMedicinalItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Non-medicinal item not found' });
    }

    if (item.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(item.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.warn('Cloudinary delete warning:', cloudinaryError.message);
      }
    }

    await NonMedicinalItem.findByIdAndDelete(req.params.id);

    return res.json({
      message: 'Non-medicinal item deleted successfully',
      item,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to delete non-medicinal item',
    });
  }
});

module.exports = router;
