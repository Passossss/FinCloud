# Fin - Microservices Architecture

Aplicativo de gestão financeira pessoal construído com arquitetura de microserviços.

## 🏗️ Arquitetura

O projeto é composto por 3 serviços principais:

### 1. BFF (Backend for Frontend) - Porta 3000
- **Responsabilidade**: Gateway de APIs e orquestração de serviços
- **Tecnologia**: Node.js + Express
- **Funcionalidades**:
  - Proxy para microserviços
  - Rate limiting e segurança
  - Health checks centralizados

### 2. User Service - Porta 3001
- **Responsabilidade**: Gerenciamento de usuários e perfis
- **Banco de Dados**: Azure SQL Server Free (1 DTU)
- **Funcionalidades**:
  - Registro e autenticação de usuários
  - Gerenciamento de perfis financeiros
  - Estatísticas de usuários

### 3. Transaction Service - Porta 3002
- **Responsabilidade**: Gerenciamento de transações financeiras
- **Banco de Dados**: MongoDB Atlas Free
- **Funcionalidades**:
  - CRUD de transações
  - Relatórios e resumos financeiros
  - Categorização automática

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+
- Conta no Azure SQL Server
- Conta no MongoDB Atlas

### 1. Instalação das Dependências
```bash
npm run install-all
```

### 2. Configuração das Variáveis de Ambiente

**BFF (.env)**:
```env
PORT=3000
FRONTEND_URL=http://localhost:5173
USER_SERVICE_URL=http://localhost:3001
TRANSACTION_SERVICE_URL=http://localhost:3002
```

**User Service (.env)**:
```env
PORT=3001
JWT_SECRET=your_super_secret_jwt_key
DB_SERVER=your_server.database.windows.net
DB_NAME=fin_users_db
DB_USER=your_username
DB_PASSWORD=your_password
```

**Transaction Service (.env)**:
```env
PORT=3002
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/fin_transactions
```

### 3. Execução
```bash
# Desenvolvimento (todos os serviços)
npm run dev

# Produção
npm start
```

## 📊 Endpoints Principais

### BFF (http://localhost:3000)
- `GET /api/health` - Health check geral
- `POST /api/users/register` - Registro de usuário
- `POST /api/users/login` - Login
- `GET /api/transactions/user/:id` - Transações do usuário

### User Service (http://localhost:3001)
- `POST /api/users/register` - Criar usuário
- `POST /api/users/login` - Autenticar usuário
- `GET /api/users/profile/:id` - Obter perfil
- `PUT /api/users/profile/:id` - Atualizar perfil

### Transaction Service (http://localhost:3002)
- `POST /api/transactions` - Criar transação
- `GET /api/transactions/user/:userId` - Listar transações
- `GET /api/transactions/user/:userId/summary` - Resumo financeiro
- `PUT /api/transactions/:id` - Atualizar transação
- `DELETE /api/transactions/:id` - Excluir transação

## 🗄️ Estrutura de Dados

### Usuários (SQL Server)
```sql
users: id, email, password, name, age, created_at, is_active
user_profiles: id, user_id, monthly_income, financial_goals, spending_limit
```

### Transações (MongoDB)
```javascript
{
  userId: String,
  amount: Number,
  description: String,
  category: String, // food, transport, entertainment, etc.
  type: String, // income, expense
  date: Date,
  tags: [String],
  isRecurring: Boolean,
  recurringPeriod: String
}
```

## 🔒 Segurança

- JWT para autenticação
- Helmet para headers de segurança
- Rate limiting no BFF
- Validação de dados with Joi
- Sanitização de inputs
- CORS configurado

## 📈 Monitoramento

- Logs centralizados (Morgan)
- Health checks em todos os serviços
- Métricas de performance
- Error tracking

## 🧪 Testes

```bash
# Executar testes em todos os serviços
npm test
```

## 🔧 Desenvolvimento

### Adicionando Novos Serviços
1. Crie nova pasta na raiz
2. Configure package.json
3. Adicione scripts no package.json raiz
4. Configure rotas no BFF

### Padrões de Código
- ESLint configurado
- Prettier para formatação
- Conventional Commits
- Documentação inline

## 📱 Frontend Integration

O BFF expõe uma API RESTful que pode ser consumida por qualquer cliente:
- React Native (mobile)
- React/Vue (web)
- Flutter (cross-platform)

Todas as rotas seguem padrões REST com responses JSON consistentes.