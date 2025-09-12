const express = require('express');
const axios = require('axios');
const router = express.Router();

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3002';

// Middleware para proxy das requisições
const proxyToTransactionService = async (req, res, next) => {
  try {
    const config = {
      method: req.method,
      url: `${TRANSACTION_SERVICE_URL}/api/transactions${req.path}`,
      data: req.body,
      params: req.query,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      }
    };

    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Transaction Service Error:', error.message);
      res.status(503).json({ 
        error: 'Transaction service unavailable',
        message: 'Serviço de transações temporariamente indisponível'
      });
    }
  }
};

// Rotas de transações
router.post('/', proxyToTransactionService);
router.get('/user/:userId', proxyToTransactionService);
router.get('/:id', proxyToTransactionService);
router.put('/:id', proxyToTransactionService);
router.delete('/:id', proxyToTransactionService);
router.get('/user/:userId/summary', proxyToTransactionService);
router.get('/user/:userId/categories', proxyToTransactionService);

module.exports = router;