const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const userRoutes = require('./routes/userRoutes');
const { initDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

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
    service: 'user-service',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/users', userRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('User Service Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    service: 'user-service'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('📊 Database connected successfully');
    
    app.listen(PORT, () => {
      console.log(`👥 User Service running on port ${PORT}`);
      console.log(`🏦 Connected to Azure SQL Server`);
    });
  } catch (error) {
    console.error('Failed to start User Service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;