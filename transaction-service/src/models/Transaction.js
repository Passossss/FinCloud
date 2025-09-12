const mongoose = require('mongoose');

// Mock database storage
let mockTransactions = new Map();
let useMockDatabase = false;

// Check if we should use mock database
const shouldUseMock = () => {
  return !mongoose.connection.readyState || useMockDatabase;
};

// Enable mock database
const enableMockDatabase = () => {
  useMockDatabase = true;
};

const transactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        return v !== 0;
      },
      message: 'Amount cannot be zero'
    }
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  category: {
    type: String,
    required: true,
    enum: [
      'food', 'transport', 'entertainment', 'shopping', 'bills', 
      'health', 'education', 'salary', 'freelance', 'investment',
      'gift', 'other'
    ]
  },
  type: {
    type: String,
    required: true,
    enum: ['income', 'expense']
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPeriod: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: function() {
      return this.isRecurring;
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para performance
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1 });
transactionSchema.index({ userId: 1, type: 1 });

// Virtual para valor absoluto
transactionSchema.virtual('absoluteAmount').get(function() {
  return Math.abs(this.amount);
});

// Método estático para obter resumo financeiro
transactionSchema.statics.getFinancialSummary = async function(userId, startDate, endDate) {
  if (shouldUseMock()) {
    return getMockFinancialSummary(userId, startDate, endDate);
  }
  
  const pipeline = [
    {
      $match: {
        userId: userId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Método estático para resumo por categoria
transactionSchema.statics.getCategorySummary = async function(userId, startDate, endDate) {
  if (shouldUseMock()) {
    return getMockCategorySummary(userId, startDate, endDate);
  }
  
  const pipeline = [
    {
      $match: {
        userId: userId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: {
          category: '$category',
          type: '$type'
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { total: -1 }
    }
  ];

  return await this.aggregate(pipeline);
};

// Mock database functions
const getMockFinancialSummary = (userId, startDate, endDate) => {
  const transactions = Array.from(mockTransactions.values())
    .filter(t => t.userId === userId && 
             new Date(t.date) >= new Date(startDate) && 
             new Date(t.date) <= new Date(endDate));
  
  const summary = transactions.reduce((acc, t) => {
    if (!acc[t.type]) {
      acc[t.type] = { _id: t.type, total: 0, count: 0, avgAmount: 0 };
    }
    acc[t.type].total += t.amount;
    acc[t.type].count += 1;
    return acc;
  }, {});
  
  Object.values(summary).forEach(s => {
    s.avgAmount = s.total / s.count;
  });
  
  return Object.values(summary);
};

const getMockCategorySummary = (userId, startDate, endDate) => {
  const transactions = Array.from(mockTransactions.values())
    .filter(t => t.userId === userId && 
             new Date(t.date) >= new Date(startDate) && 
             new Date(t.date) <= new Date(endDate));
  
  const summary = transactions.reduce((acc, t) => {
    const key = `${t.category}-${t.type}`;
    if (!acc[key]) {
      acc[key] = { _id: { category: t.category, type: t.type }, total: 0, count: 0 };
    }
    acc[key].total += t.amount;
    acc[key].count += 1;
    return acc;
  }, {});
  
  return Object.values(summary).sort((a, b) => b.total - a.total);
};

// Mock Transaction class
class MockTransaction {
  constructor(data) {
    this._id = require('crypto').randomUUID();
    this.userId = data.userId;
    this.amount = data.amount;
    this.description = data.description;
    this.category = data.category;
    this.type = data.type;
    this.date = data.date || new Date();
    this.tags = data.tags || [];
    this.isRecurring = data.isRecurring || false;
    this.recurringPeriod = data.recurringPeriod;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
  
  async save() {
    mockTransactions.set(this._id, this);
    return this;
  }
  
  static async find(filter = {}) {
    let transactions = Array.from(mockTransactions.values());
    
    if (filter.userId) {
      transactions = transactions.filter(t => t.userId === filter.userId);
    }
    if (filter.category) {
      transactions = transactions.filter(t => t.category === filter.category);
    }
    if (filter.type) {
      transactions = transactions.filter(t => t.type === filter.type);
    }
    if (filter.date) {
      if (filter.date.$gte) {
        transactions = transactions.filter(t => new Date(t.date) >= new Date(filter.date.$gte));
      }
      if (filter.date.$lte) {
        transactions = transactions.filter(t => new Date(t.date) <= new Date(filter.date.$lte));
      }
    }
    
    return {
      sort: () => ({
        limit: () => ({
          skip: () => ({
            lean: () => transactions
          })
        })
      })
    };
  }
  
  static async countDocuments(filter = {}) {
    const result = await this.find(filter);
    return result.sort().limit().skip().lean().length;
  }
  
  static async findById(id) {
    return mockTransactions.get(id) || null;
  }
  
  static async findByIdAndUpdate(id, update, options = {}) {
    const transaction = mockTransactions.get(id);
    if (!transaction) return null;
    
    Object.assign(transaction, update);
    transaction.updatedAt = new Date();
    mockTransactions.set(id, transaction);
    
    return transaction;
  }
  
  static async findByIdAndDelete(id) {
    const transaction = mockTransactions.get(id);
    if (transaction) {
      mockTransactions.delete(id);
    }
    return transaction;
  }
  
  static async aggregate(pipeline) {
    // Simplified aggregation for mock
    return [];
  }
  
  static getFinancialSummary = transactionSchema.statics.getFinancialSummary;
  static getCategorySummary = transactionSchema.statics.getCategorySummary;
}

const Transaction = mongoose.model('Transaction', transactionSchema);
