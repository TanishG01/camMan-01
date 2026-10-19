const mongoose = require('mongoose');

let cachedConnection = null;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const errorMsg = 'MONGODB_URI is not defined. On Vercel, please set MONGODB_URI in Project Settings -> Environment Variables to your cloud MongoDB connection string (e.g. MongoDB Atlas).';
    console.error(`[MongoDB] Configuration error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (process.env.VERCEL && (uri.includes('127.0.0.1') || uri.includes('localhost'))) {
    const errorMsg = 'MONGODB_URI is pointing to localhost (127.0.0.1). Cloud serverless functions on Vercel cannot access your local MongoDB. Please set MONGODB_URI in Vercel Project Settings to a remote MongoDB Atlas cluster URI.';
    console.error(`[MongoDB] Configuration error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    cachedConnection = await mongoose.connect(uri);
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
