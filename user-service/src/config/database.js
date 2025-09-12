const sql = require('mssql');
require('dotenv').config();

// Mock database for development environment
const mockDatabase = {
  users: new Map(),
  user_profiles: new Map()
};

let useMockDatabase = false;

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  // Fallback values for development
  ...(process.env.NODE_ENV === 'development' && {
    server: process.env.DB_SERVER || 'localhost',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'YourPassword123',
    database: process.env.DB_NAME || 'fin_users_db'
  }),
  options: {
    encrypt: true, // Azure SQL requer SSL
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

const initDatabase = async () => {
  try {
    // Try to connect to real database first
    try {
      poolPromise = await sql.connect(config);
      await createTables();
      console.log('✅ Connected to Azure SQL Server');
      return poolPromise;
    } catch (dbError) {
      console.log('⚠️  Could not connect to Azure SQL Server, using mock database for development');
      useMockDatabase = true;
      await createMockTables();
      return { isMock: true };
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

const createTables = async () => {
  try {
    const pool = await poolPromise;
    
    // Tabela de usuários
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      CREATE TABLE users (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(255) UNIQUE NOT NULL,
        password NVARCHAR(255) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        age INT,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        is_active BIT DEFAULT 1
      )
    `);
    
    // Tabela de perfis financeiros
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_profiles' AND xtype='U')
      CREATE TABLE user_profiles (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        monthly_income DECIMAL(10,2) DEFAULT 0,
        financial_goals NVARCHAR(MAX),
        spending_limit DECIMAL(10,2) DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('✅ Tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

const createMockTables = async () => {
  console.log('✅ Mock database initialized');
};

const getPool = () => {
  if (useMockDatabase) {
    return createMockPool();
  }
  return poolPromise;
};

const createMockPool = () => {
  return {
    request: () => ({
      input: function(name, type, value) {
        this.inputs = this.inputs || {};
        this.inputs[name] = value;
        return this;
      },
      query: async function(queryString) {
        // Mock query responses based on query type
        if (queryString.includes('SELECT') && queryString.includes('users') && queryString.includes('email')) {
          const email = this.inputs?.email;
          const user = Array.from(mockDatabase.users.values()).find(u => u.email === email);
          return { recordset: user ? [user] : [] };
        }
        
        if (queryString.includes('INSERT INTO users')) {
          const id = require('crypto').randomUUID();
          const user = {
            id,
            email: this.inputs?.email,
            password: this.inputs?.password,
            name: this.inputs?.name,
            age: this.inputs?.age,
            created_at: new Date(),
            is_active: true
          };
          mockDatabase.users.set(id, user);
          return { recordset: [user] };
        }
        
        if (queryString.includes('INSERT INTO user_profiles')) {
          const id = require('crypto').randomUUID();
          const profile = {
            id,
            user_id: this.inputs?.user_id,
            monthly_income: this.inputs?.monthly_income || 0,
            spending_limit: this.inputs?.spending_limit || 0
          };
          mockDatabase.user_profiles.set(id, profile);
          return { recordset: [profile] };
        }
        
        if (queryString.includes('SELECT') && queryString.includes('user_profiles')) {
          const userId = this.inputs?.id;
          const user = mockDatabase.users.get(userId);
          const profile = Array.from(mockDatabase.user_profiles.values()).find(p => p.user_id === userId);
          
          if (user) {
            return {
              recordset: [{
                ...user,
                monthly_income: profile?.monthly_income || 0,
                financial_goals: profile?.financial_goals || null,
                spending_limit: profile?.spending_limit || 0
              }]
            };
          }
          return { recordset: [] };
        }
        
        return { recordset: [] };
      }
    })
  };
};

module.exports = {
  initDatabase,
  getPool,
  sql
};