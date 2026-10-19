const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : path.resolve(__dirname, '../../firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Firebase] Admin SDK initialized successfully');
  } catch (err) {
    console.warn('[Firebase] Warning: Failed to initialize Firebase Admin SDK from file:', err.message);
  }
} else {
  console.warn(`[Firebase] Notice: Service account file not found at ${serviceAccountPath}. Using mock/fallback for dev.`);
  // Initialize mock or default app if needed
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'camman-01'
    });
  }
}

module.exports = admin;
