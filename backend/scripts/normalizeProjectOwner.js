require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const RESERVED_EMAIL = 'mishrasushant029@gmail.com';

async function normalizeProjectOwner() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing. Set it in backend/.env before running this migration.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });

  const normalizedEmail = RESERVED_EMAIL.trim().toLowerCase();
  const existingUsers = await User.find({ email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });

  if (!existingUsers.length) {
    console.log(`No account found for ${normalizedEmail}. No migration needed.`);
    await mongoose.disconnect();
    return;
  }

  if (existingUsers.length > 1) {
    console.warn(`Found ${existingUsers.length} matching accounts. Keeping the oldest and removing duplicate copies...`);
    const [keeper, ...duplicates] = existingUsers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    for (const dup of duplicates) {
      await User.deleteOne({ _id: dup._id });
      console.log(`Deleted duplicate Project Owner record: ${dup._id}`);
    }

    keeper.name = keeper.name || 'Sushant';
    keeper.email = normalizedEmail;
    keeper.role = 'admin';
    keeper.accountStatus = 'active';
    keeper.verificationStatus = 'approved';
    keeper.isVerified = true;
    keeper.password = keeper.password || 'protected-owner-account';
    await keeper.save();
    console.log(`Normalized primary Project Owner record: ${keeper._id}`);
    await mongoose.disconnect();
    return;
  }

  const owner = existingUsers[0];
  owner.name = owner.name || 'Sushant';
  owner.email = normalizedEmail;
  owner.role = 'admin';
  owner.accountStatus = 'active';
  owner.verificationStatus = 'approved';
  owner.isVerified = true;
  await owner.save();

  console.log(`Project Owner account normalized successfully: ${owner._id}`);
  await mongoose.disconnect();
}

normalizeProjectOwner().catch((error) => {
  console.error('Project Owner migration failed:', error);
  process.exit(1);
});
