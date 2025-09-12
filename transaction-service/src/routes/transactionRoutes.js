const express = require('express');
const Joi = require('joi');
let Transaction = require('../models/Transaction');

// Check if we should use mock database
const shouldUseMock = () => {
  const mongoose = require('mongoose');
  return !mongoose.connection.readyState;
};

const router = express.Router();

// Validação schemas
const transactionSchema = Joi.object({
  userId: Joi.string().required(),
  amount: Joi.number().not(0).required(),
  description: Joi.string().max(200).required(),
  category: Joi.string().valid(
    'food', 'transport', 'entertainment', 'shopping', 'bills', 
    'health', 'education', 'salary', 'freelance', 'investment',
    'gift', 'other'
  ).required(),
  type: Joi.string().valid('income', 'expense').required(),
  date: Joi.date().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  isRecurring: Joi.boolean().optional(),
  recurringPeriod: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').optional()
});

// Criar nova transação
router.post('/', async (req, res) => {
  try {
    const { error, value } = transactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.details 
      });
    }

    // Ajustar valor baseado no tipo
    if (value.type === 'expense' && value.amount > 0) {
      value.amount = -Math.abs(value.amount);
    } else if (value.type === 'income' && value.amount < 0) {
      value.amount = Math.abs(value.amount);
    }

    // Use mock transaction if database is not available
    if (shouldUseMock()) {
      const MockTransaction = require('../models/Transaction');
      const transaction = new MockTransaction(value);
      await transaction.save();
      return res.status(201).json({
        message: 'Transaction created successfully',
        transaction
      });
    }
    
    const transaction = new Transaction(value);
    await transaction.save();

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction
    });

  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Obter transações de um usuário
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, category, type, startDate, endDate } = req.query;

    const filter = { userId };

    // Filtros opcionais
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction
      .find(filter)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Transaction.countDocuments(filter);

    res.json({
      transactions,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Obter transação específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ 
        error: 'Transaction not found',
        message: 'Transação não encontrada'
      });
    }

    res.json({ transaction });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Atualizar transação
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error, value } = transactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.details 
      });
    }

    // Ajustar valor baseado no tipo
    if (value.type === 'expense' && value.amount > 0) {
      value.amount = -Math.abs(value.amount);
    } else if (value.type === 'income' && value.amount < 0) {
      value.amount = Math.abs(value.amount);
    }

    const transaction = await Transaction.findByIdAndUpdate(
      id, 
      value, 
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({ 
        error: 'Transaction not found',
        message: 'Transação não encontrada'
      });
    }

    res.json({
      message: 'Transaction updated successfully',
      transaction
    });

  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Deletar transação
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await Transaction.findByIdAndDelete(id);
    if (!transaction) {
      return res.status(404).json({ 
        error: 'Transaction not found',
        message: 'Transação não encontrada'
      });
    }

    res.json({ 
      message: 'Transaction deleted successfully',
      message_pt: 'Transação excluída com sucesso'
    });

  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Resumo financeiro do usuário
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = '30d' } = req.query;

    // Calcular datas baseado no período
    const endDate = new Date();
    const startDate = new Date();
    
    switch(period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    const [summary, categorySummary] = await Promise.all([
      Transaction.getFinancialSummary(userId, startDate, endDate),
      Transaction.getCategorySummary(userId, startDate, endDate)
    ]);

    const income = summary.find(s => s._id === 'income')?.total || 0;
    const expenses = Math.abs(summary.find(s => s._id === 'expense')?.total || 0);
    const balance = income - expenses;

    res.json({
      period,
      summary: {
        income,
        expenses,
        balance,
        total_transactions: summary.reduce((acc, s) => acc + s.count, 0)
      },
      categories: categorySummary
    });

  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Categorias mais utilizadas
router.get('/user/:userId/categories', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = '30d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(period.replace('d', '')));

    const categories = await Transaction.aggregate([
      {
        $match: {
          userId: userId,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          total_amount: { $sum: { $abs: '$amount' } }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({ categories });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;