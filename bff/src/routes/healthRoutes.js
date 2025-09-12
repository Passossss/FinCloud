const express = require('express');
const axios = require('axios');
const router = express.Router();

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3002';

router.get('/', async (req, res) => {
  try {
    const healthChecks = await Promise.allSettled([
      axios.get(`${USER_SERVICE_URL}/health`, { timeout: 5000 }),
      axios.get(`${TRANSACTION_SERVICE_URL}/health`, { timeout: 5000 })
    ]);

    const userServiceHealth = healthChecks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy';
    const transactionServiceHealth = healthChecks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy';

    const overallHealth = userServiceHealth === 'healthy' && transactionServiceHealth === 'healthy' ? 'healthy' : 'degraded';

    res.json({
      status: overallHealth,
      timestamp: new Date().toISOString(),
      services: {
        bff: 'healthy',
        userService: userServiceHealth,
        transactionService: transactionServiceHealth
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;