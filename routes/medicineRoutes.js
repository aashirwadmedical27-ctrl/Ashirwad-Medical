const express = require('express');
const cloudinary = require('cloudinary').v2;
const Medicine = require('../models/Medicine');
const { protect, requireAdmin } = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();

const medicineFields = [
  'name',
  'manufacturer',
  'image',
  'cloudinaryPublicId',
  'uploadedBy',
  'description',
  'tabletsPerStrip',
  'price',
  'stock',
  'expiryDate',
  'prescriptionRequired',
];

router.get('/', async (req, res) => {
  try {
    const medicines = await Medicine.find().sort({ createdAt: -1 });

    return res.json({
      count: medicines.length,
      medicines,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch medicines',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    return res.json({ medicine });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch medicine',
    });
  }
});

router.post('/', protect, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      manufacturer,
      image,
      cloudinaryPublicId,
      uploadedBy,
      description,
      tabletsPerStrip,
      price,
      stock,
      expiryDate,
      prescriptionRequired,
    } = req.body;

    if (!name || !manufacturer || !image) {
      return res.status(400).json({
        message: 'Medicine name, manufacturer, and image URL are required',
      });
    }

    const medicine = await Medicine.create({
      name,
      manufacturer,
      image,
      cloudinaryPublicId: cloudinaryPublicId || '',
      uploadedBy: uploadedBy || null,
      description,
      tabletsPerStrip: Number(tabletsPerStrip) || 1,
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      totalMedicineQuantity:
        (Number(stock) || 0) * (Number(tabletsPerStrip) || 1),
      expiryDate,
      prescriptionRequired: Boolean(prescriptionRequired),
    });

    return res.status(201).json({
      message: 'Medicine uploaded successfully',
      medicine,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to save medicine',
    });
  }
});

router.patch('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const existingMedicine = await Medicine.findById(req.params.id);

    if (!existingMedicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    const isReplacingImage =
      req.body.image !== undefined &&
      req.body.image &&
      req.body.image !== existingMedicine.image;

    const isReplacingPublicId =
      req.body.cloudinaryPublicId !== undefined &&
      req.body.cloudinaryPublicId &&
      req.body.cloudinaryPublicId !== existingMedicine.cloudinaryPublicId;

    if ((isReplacingImage || isReplacingPublicId) && existingMedicine.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(existingMedicine.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.warn('Cloudinary replace warning:', cloudinaryError.message);
      }
    }

    const updates = {};

    for (const field of medicineFields) {
      if (req.body[field] !== undefined) {
        if (field === 'tabletsPerStrip' || field === 'price' || field === 'stock') {
          updates[field] = Number(req.body[field]);
        } else if (field === 'prescriptionRequired') {
          updates[field] = Boolean(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'No valid medicine fields were provided for update',
      });
    }

    const nextStock = updates.stock ?? existingMedicine.stock;
    const nextTabletsPerStrip =
      updates.tabletsPerStrip ?? existingMedicine.tabletsPerStrip;
    updates.totalMedicineQuantity =
      Number(nextStock || 0) * Number(nextTabletsPerStrip || 0);

    const medicine = await Medicine.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    return res.json({
      message: 'Medicine updated successfully',
      medicine,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to update medicine',
    });
  }
});

router.post('/:id/stock', protect, requireAdmin, async (req, res) => {
  try {
    const { direction } = req.body;
    const stripCount = Number(req.body.stripCount);

    if (!['add', 'remove'].includes(direction)) {
      return res.status(400).json({ message: 'Direction must be add or remove' });
    }

    if (!Number.isInteger(stripCount) || stripCount < 1) {
      return res.status(400).json({
        message: 'A valid strip quantity is required; enter a positive whole number',
      });
    }

    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    const tabletsPerStrip = Number(medicine.tabletsPerStrip) || 1;
    const currentStock = Number(medicine.stock) || 0;
    const storedTotal = Number(medicine.totalMedicineQuantity);
    const currentTotal = storedTotal > 0 || currentStock === 0
      ? storedTotal
      : currentStock * tabletsPerStrip;
    const tabletAdjustment = stripCount * tabletsPerStrip;

    if (direction === 'remove' && currentTotal < tabletAdjustment) {
      return res.status(409).json({
        message: `Cannot remove ${stripCount} strip(s); only ${currentTotal} tablet(s) remain`,
      });
    }

    const multiplier = direction === 'add' ? 1 : -1;
    const nextStock = Number((currentStock + multiplier * stripCount).toFixed(8));
    const nextTotal = currentTotal + multiplier * tabletAdjustment;
    const stockFilter = { _id: medicine._id, stock: medicine.stock };

    if (medicine.totalMedicineQuantity == null || (storedTotal === 0 && currentStock > 0)) {
      stockFilter.$or = [
        { totalMedicineQuantity: { $exists: false } },
        { totalMedicineQuantity: null },
        { totalMedicineQuantity: 0 },
      ];
    } else {
      stockFilter.totalMedicineQuantity = medicine.totalMedicineQuantity;
    }

    const updatedMedicine = await Medicine.findOneAndUpdate(
      stockFilter,
      {
        $set: {
          stock: nextStock,
          totalMedicineQuantity: nextTotal,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedMedicine) {
      return res.status(409).json({ message: 'Medicine stock changed; refresh and try again' });
    }

    return res.json({
      message: `${stripCount} strip(s) ${direction === 'add' ? 'added' : 'removed'}`,
      medicine: updatedMedicine,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to adjust medicine stock',
    });
  }
});

router.put('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const existingMedicine = await Medicine.findById(req.params.id);

    if (!existingMedicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    const {
      name,
      manufacturer,
      image,
      cloudinaryPublicId,
      uploadedBy,
      description,
      tabletsPerStrip,
      price,
      stock,
      expiryDate,
      prescriptionRequired,
    } = req.body;

    if (!name || !manufacturer || !image) {
      return res.status(400).json({
        message: 'Medicine name, manufacturer, and image URL are required',
      });
    }

    const isReplacingImage = image && image !== existingMedicine.image;
    const isReplacingPublicId = cloudinaryPublicId && cloudinaryPublicId !== existingMedicine.cloudinaryPublicId;

    if ((isReplacingImage || isReplacingPublicId) && existingMedicine.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(existingMedicine.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.warn('Cloudinary replace warning:', cloudinaryError.message);
      }
    }

    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      {
        name,
        manufacturer,
        image,
        cloudinaryPublicId: cloudinaryPublicId || '',
        uploadedBy: uploadedBy || null,
        description,
        tabletsPerStrip: Number(tabletsPerStrip) || 1,
        price: Number(price) || 0,
        stock: Number(stock) || 0,
        totalMedicineQuantity:
          (Number(stock) || 0) * (Number(tabletsPerStrip) || 1),
        expiryDate,
        prescriptionRequired: Boolean(prescriptionRequired),
      },
      { new: true, runValidators: true }
    );

    return res.json({
      message: 'Medicine updated successfully',
      medicine,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to update medicine',
    });
  }
});

/* ✅ NEW — DELETE medicine */
router.delete('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    if (medicine.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(medicine.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.warn('Cloudinary delete warning:', cloudinaryError.message);
      }
    }

    await Medicine.findByIdAndDelete(req.params.id);

    return res.json({
      message: 'Medicine deleted successfully',
      medicine,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to delete medicine',
    });
  }
});

module.exports = router;