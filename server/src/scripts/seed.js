// Creates demo accounts so you can log in straight away.
// Run with:  npm run seed
// All demo passwords are "password123" - for local testing only.
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { required } = require('../config/env');
const User = require('../models/User');

const DEMO_USERS = [
  { name: 'Sanjay (HR)', email: 'hr@fairview.test', role: 'hr' },
  { name: 'Meera (Client)', email: 'client@fairview.test', role: 'client' },
  { name: 'Rahul (Manager)', email: 'manager@fairview.test', role: 'manager' },
  { name: 'Priya (Employee)', email: 'priya@fairview.test', role: 'employee' },
  { name: 'Aman (Employee)', email: 'aman@fairview.test', role: 'employee' },
];

async function seed() {
  await mongoose.connect(required('MONGODB_URI'));
  const passwordHash = await bcrypt.hash('password123', 10);
  for (const u of DEMO_USERS) {
    const exists = await User.exists({ email: u.email });
    if (exists) console.log(`exists   ${u.email}`);
    else {
      await User.create({ ...u, passwordHash });
      console.log(`created  ${u.email}  (${u.role})`);
    }
  }
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
