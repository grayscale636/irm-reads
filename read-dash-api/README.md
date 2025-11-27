# ReadDash API 🚀

Backend API for IrmReads - a personal reading tracker application.

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Auth:** JWT + bcrypt
- **Security:** Helmet, Rate Limiting, CORS

## 📦 Installation

```bash
npm install
```

## ⚙️ Environment Variables

Create a `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=irmreads
DB_USER=postgres
DB_PASSWORD=your_password
PORT=8114
JWT_SECRET=your-super-secret-key-min-32-chars

# Production
NODE_ENV=production
CORS_ORIGIN=http://localhost:8080
```

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🗃️ Database Setup

Run migrations in PostgreSQL:

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create books table
CREATE TABLE books (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  cover TEXT,
  rating INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'want-to-read',
  pages_read INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  reflection TEXT,
  started_at DATE,
  finished_at DATE,
  quotes JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create reading_logs table
CREATE TABLE reading_logs (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  book_id VARCHAR(255) REFERENCES books(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pages_read INTEGER DEFAULT 0,
  start_page INTEGER DEFAULT 0,
  end_page INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Running

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run pm2:start
```

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |

### Books (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/books` | Get all books |
| GET | `/api/books/:id` | Get book by ID |
| POST | `/api/books` | Create book |
| PUT | `/api/books/:id` | Update book |
| DELETE | `/api/books/:id` | Delete book |

### Reading Logs (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reading-logs` | Get all logs |
| GET | `/api/reading-logs/book/:bookId` | Get logs by book |
| POST | `/api/reading-logs` | Create log |
| DELETE | `/api/reading-logs/:id` | Delete log |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

## 🔒 Security Features

- **Helmet** - Security headers
- **Rate Limiting** - 200 req/15min (general), 10 req/15min (auth)
- **CORS** - Configurable origins
- **JWT** - Token-based authentication
- **bcrypt** - Password hashing

## 📁 Project Structure

```
read-dash-api/
├── src/
│   ├── index.ts          # Express app entry
│   ├── db.ts             # PostgreSQL connection
│   ├── types.ts          # TypeScript types
│   ├── middleware/
│   │   └── auth.ts       # JWT middleware
│   └── routes/
│       ├── auth.ts       # Auth routes
│       ├── books.ts      # Books CRUD
│       └── readingLogs.ts # Reading logs CRUD
├── migrations/           # SQL migrations
├── logs/                 # PM2 logs
├── ecosystem.config.js   # PM2 config
└── package.json
```

## 📄 License

MIT
