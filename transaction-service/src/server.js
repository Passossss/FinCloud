const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const transactionRoutes = require('./routes/transactionRoutes');
const { connectDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'transaction-service',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/transactions', transactionRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Transaction Service Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    service: 'transaction-service'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await connectDatabase();
    console.log('🍃 MongoDB connected successfully');
    
    app.listen(PORT, () => {
      console.log(`💰 Transaction Service running on port ${PORT}`);
      console.log(`🌿 Connected to MongoDB Atlas`);
    });
  } catch (error) {
    console.error('Failed to start Transaction Service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;