# IrmReads 📚

A personal reading tracker and dashboard application to manage your book collection, track reading progress, and analyze reading habits.

## 🏗️ Project Structure

```
IrmReads/
├── read-dash/          # Frontend (React + Vite)
├── read-dash-api/      # Backend (Express + PostgreSQL)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- PM2 (for production)

### Development

**Backend:**
```bash
cd read-dash-api
npm install
npm run dev
```

**Frontend:**
```bash
cd read-dash
npm install
npm run dev
```

### Production (PM2)

```bash
# Start API
cd read-dash-api
npm run build
npm run pm2:start

# Start Frontend
cd read-dash
npm run build
npm run pm2:start

# Check status
pm2 status

# Save for auto-restart
pm2 save
```

## 🌐 URLs

| Service | Development | Production |
|---------|-------------|------------|
| Frontend | http://localhost:5173 | http://localhost:8080 |
| API | http://localhost:8211 | http://localhost:8211 |

## ✨ Features

- 📖 Book management (add, edit, delete)
- 📊 Reading progress tracking
- 📈 Reading statistics & analytics
- 📅 Reading log with start/end pages
- 🔐 User authentication (JWT)
- 🌙 Dark/Light theme
- 📱 Responsive design

## 📄 License

MIT
