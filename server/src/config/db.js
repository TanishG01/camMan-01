const mongoose = require('mongoose');

let cachedConnection = null;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  try {
    cachedConnection = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[MongoDB] Connected: ${cachedConnection.connection.host}`);
    return cachedConnection;
  } catch (err) {
    console.error(`[MongoDB] Connection error: ${err.message}`);
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw err;
    }
    process.exit(1);
  }
};

module.exports = connectDB;
