const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const apiRoutes = require('./routes');
const { initCronJobs } = require('./services/reminderCron');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate Limiter
app.use('/api', apiLimiter);

// Mount API routes
app.use('/api/v1', apiRoutes);

// Global Error Handler
app.use(errorHandler);

// Connect DB & Start Server
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    initCronJobs();
    app.listen(PORT, () => {
      console.log(`[FestOps Server] Running on http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
