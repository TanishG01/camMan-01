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
    const errorMsg = `MONGODB_URI is currently set to "${uri}" on Vercel. Cloud serverless functions cannot connect to localhost/127.0.0.1. Please update MONGODB_URI in your Vercel Project Settings (Settings -> Environment Variables) to your MongoDB Atlas cluster URI, and click Redeploy.`;
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
