require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing in your .env file');
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminPhone = process.env.ADMIN_PHONE || '9999999999';

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in Backend/.env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: adminEmail });

    if (existing) {
      existing.role = 'admin';
      existing.phone = existing.phone || adminPhone;
      if (existing.password && !existing.password.startsWith('$2')) {
        existing.password = await bcrypt.hash(adminPassword, 10);
      }
      if (existing.password && existing.password.startsWith('$2')) {
        existing.password = await bcrypt.hash(adminPassword, 10);
      }
      await existing.save();
      console.log('Admin user updated successfully');
      console.log('Email:', adminEmail);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const adminUser = await User.create({
      name: 'Admin User',
      email: adminEmail,
      phone: adminPhone,
      password: hashedPassword,
      role: 'admin',
    });

    console.log('Admin user created successfully');
    console.log('Email:', adminUser.email);
    process.exit(0);
  } catch (error) {
    console.error('Admin setup failed:', error.message);
    process.exit(1);
  }
};

run();
