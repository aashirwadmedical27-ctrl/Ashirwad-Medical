const express = require('express');
const Settings = require('../models/OfferToDisplay');
const { protect, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const offerFields = ['minAmount', 'maxAmount', 'discountPercentage', 'freeItem', 'isActive'];

router.get('/offers', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    const offers = settings?.offers || [];

    return res.json({
      count: offers.length,
      offers,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch offers',
    });
  }
});

router.use(protect);
router.use(requireAdmin);

router.get('/settings', async (req, res) => {
  try {
    const settings = await Settings.findOne() || await Settings.create({ homepageOffer: '', offers: [] });

    return res.json({
      settings,
      homepageOffer: settings.homepageOffer || '',
      offers: settings.offers || [],
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch settings',
    });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const updates = {};

    if (req.body.homepageOffer !== undefined) {
      updates.homepageOffer = req.body.homepageOffer;
    }

    if (req.body.offers !== undefined) {
      updates.offers = req.body.offers;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'No settings field provided for update',
      });
    }

    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({ ...updates, offers: updates.offers || [] });
      return res.json({
        message: 'Settings created successfully',
        settings,
      });
    }

    Object.assign(settings, updates);
    await settings.save();

    return res.json({
      message: 'Settings updated successfully',
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to update settings',
    });
  }
});

router.post('/offers', async (req, res) => {
  try {
    const { minAmount, maxAmount, discountPercentage, freeItem, isActive } = req.body;

    if (minAmount === undefined) {
      return res.status(400).json({
        message: 'minAmount is required',
      });
    }

    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({ homepageOffer: '', offers: [] });
    }

    const offer = {
      minAmount: Number(minAmount),
      maxAmount: maxAmount !== undefined ? Number(maxAmount) : undefined,
      discountPercentage: discountPercentage !== undefined ? Number(discountPercentage) : undefined,
      freeItem: freeItem || undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    };

    settings.offers.push(offer);
    await settings.save();

    return res.status(201).json({
      message: 'Offer created successfully',
      offer: settings.offers[settings.offers.length - 1],
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to create offer',
    });
  }
});

router.patch('/offers/:id', async (req, res) => {
  try {
    const settings = await Settings.findOne();

    if (!settings) {
      return res.status(404).json({ message: 'No settings document found' });
    }

    const offer = settings.offers.id(req.params.id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    const updates = {};

    for (const field of offerFields) {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'isActive' ? Boolean(req.body[field]) : req.body[field];

        if (['minAmount', 'maxAmount', 'discountPercentage'].includes(field)) {
          updates[field] = Number(req.body[field]);
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'No offer field provided for update',
      });
    }

    Object.assign(offer, updates);
    await settings.save();

    return res.json({
      message: 'Offer updated successfully',
      offer,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to update offer',
    });
  }
});

router.put('/offers/:id', async (req, res) => {
  try {
    const settings = await Settings.findOne();

    if (!settings) {
      return res.status(404).json({ message: 'No settings document found' });
    }

    const offer = settings.offers.id(req.params.id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    const nextOffer = {
      minAmount: Number(req.body.minAmount) || 0,
      maxAmount: req.body.maxAmount !== undefined ? Number(req.body.maxAmount) : undefined,
      discountPercentage: req.body.discountPercentage !== undefined ? Number(req.body.discountPercentage) : undefined,
      freeItem: req.body.freeItem || undefined,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
    };

    Object.assign(offer, nextOffer);
    await settings.save();

    return res.json({
      message: 'Offer replaced successfully',
      offer,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to replace offer',
    });
  }
});

router.delete('/offers/:id', async (req, res) => {
  try {
    const settings = await Settings.findOne();

    if (!settings) {
      return res.status(404).json({ message: 'No settings document found' });
    }

    const offer = settings.offers.id(req.params.id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    settings.offers.pull(req.params.id);
    await settings.save();

    return res.json({
      message: 'Offer deleted successfully',
      deletedOffer: offer,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to delete offer',
    });
  }
});

module.exports = router;
