const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { getPool, sql } = require('../config/database');

const router = express.Router();

// Validação schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).required(),
  age: Joi.number().integer().min(13).max(120).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Registro de usuário
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.details 
      });
    }

    const { email, password, name, age } = value;
    const pool = await getPool();

    // Verificar se usuário já existe
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM users WHERE email = @email');

    if (existingUser.recordset.length > 0) {
      return res.status(409).json({ 
        error: 'User already exists',
        message: 'Usuário já cadastrado com este email'
      });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('name', sql.NVarChar, name)
      .input('age', sql.Int, age || null)
      .query(`
        INSERT INTO users (email, password, name, age) 
        OUTPUT inserted.id, inserted.email, inserted.name, inserted.age, inserted.created_at
        VALUES (@email, @password, @name, @age)
      `);

    const user = result.recordset[0];

    // Criar perfil financeiro padrão
    await pool.request()
      .input('user_id', sql.UniqueIdentifier, user.id)
      .query(`
        INSERT INTO user_profiles (user_id, monthly_income, spending_limit) 
        VALUES (@user_id, 0, 0)
      `);

    // Gerar token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age
      },
      token
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Login de usuário
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.details 
      });
    }

    const { email, password } = value;
    const pool = await getPool();

    // Buscar usuário
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT id, email, password, name, age, is_active 
        FROM users 
        WHERE email = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email ou senha incorretos'
      });
    }

    const user = result.recordset[0];

    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Account inactive',
        message: 'Conta desativada'
      });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email ou senha incorretos'
      });
    }

    // Gerar token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Obter perfil do usuário
router.get('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          u.id, u.email, u.name, u.age, u.created_at,
          p.monthly_income, p.financial_goals, p.spending_limit
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.id = @id AND u.is_active = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'Usuário não encontrado'
      });
    }

    const user = result.recordset[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age,
        created_at: user.created_at,
        profile: {
          monthly_income: user.monthly_income,
          financial_goals: user.financial_goals,
          spending_limit: user.spending_limit
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Atualizar perfil do usuário
router.put('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, age, monthly_income, financial_goals, spending_limit } = req.body;
    const pool = await getPool();

    // Atualizar dados básicos do usuário
    if (name || age !== undefined) {
      await pool.request()
        .input('id', sql.UniqueIdentifier, id)
        .input('name', sql.NVarChar, name)
        .input('age', sql.Int, age)
        .query(`
          UPDATE users 
          SET name = COALESCE(@name, name),
              age = COALESCE(@age, age),
              updated_at = GETDATE()
          WHERE id = @id
        `);
    }

    // Atualizar perfil financeiro
    if (monthly_income !== undefined || financial_goals !== undefined || spending_limit !== undefined) {
      await pool.request()
        .input('user_id', sql.UniqueIdentifier, id)
        .input('monthly_income', sql.Decimal(10,2), monthly_income)
        .input('financial_goals', sql.NVarChar, financial_goals)
        .input('spending_limit', sql.Decimal(10,2), spending_limit)
        .query(`
          UPDATE user_profiles 
          SET monthly_income = COALESCE(@monthly_income, monthly_income),
              financial_goals = COALESCE(@financial_goals, financial_goals),
              spending_limit = COALESCE(@spending_limit, spending_limit),
              updated_at = GETDATE()
          WHERE user_id = @user_id
        `);
    }

    res.json({ 
      message: 'Profile updated successfully',
      message_pt: 'Perfil atualizado com sucesso'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Estatísticas do usuário
router.get('/stats/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          u.name,
          u.created_at,
          p.monthly_income,
          p.spending_limit,
          DATEDIFF(day, u.created_at, GETDATE()) as days_since_registration
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.id = @id AND u.is_active = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'Usuário não encontrado'
      });
    }

    const stats = result.recordset[0];
    res.json({
      stats: {
        name: stats.name,
        member_since: stats.created_at,
        days_active: stats.days_since_registration,
        monthly_income: stats.monthly_income,
        spending_limit: stats.spending_limit,
        profile_completion: calculateProfileCompletion(stats)
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

function calculateProfileCompletion(stats) {
  let completion = 30; // Cadastro básico
  if (stats.monthly_income > 0) completion += 35;
  if (stats.spending_limit > 0) completion += 35;
  return Math.min(completion, 100);
}

module.exports = router;