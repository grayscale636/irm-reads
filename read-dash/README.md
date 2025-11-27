# ReadDash Frontend 📖

React frontend for IrmReads - a personal reading tracker application.

## 🛠️ Tech Stack

- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Routing:** React Router
- **Charts:** Recharts
- **Icons:** Lucide React

## 📦 Installation

```bash
npm install
```

## ⚙️ Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:8114/api
```

## 🚀 Running

### Development
```bash
npm run dev
```
Open http://localhost:5173

### Build
```bash
npm run build
```

### Production (PM2)
```bash
npm run build
npm run pm2:start
```
Open http://localhost:8080

## 📁 Project Structure

```
read-dash/
├── src/
│   ├── main.tsx              # App entry
│   ├── App.tsx               # Router setup
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── AddBookDialog.tsx
│   │   ├── BookCard.tsx
│   │   ├── BookGrid.tsx
│   │   ├── ReadingChart.tsx
│   │   ├── StatsCards.tsx
│   │   └── ThemeToggle.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx   # Auth state
│   │   └── BooksContext.tsx  # Books state
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   ├── use-theme.ts
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── api.ts            # API client
│   │   └── utils.ts
│   └── pages/
│       ├── Index.tsx         # Library page
│       ├── Dashboard.tsx     # Stats dashboard
│       ├── BookDetail.tsx    # Book detail view
│       ├── Login.tsx
│       ├── Register.tsx
│       └── NotFound.tsx
├── public/
├── dist/                     # Build output
├── logs/                     # PM2 logs
├── ecosystem.config.cjs      # PM2 config
├── server.cjs                # Production server
└── package.json
```

## ✨ Features

### 📚 Library
- View all books with cover images
- Filter by status (Reading, Completed, Want to Read)
- Search books
- Add new books
- Quick status update

### 📖 Book Detail
- View/edit book details
- Upload book cover
- Track reading progress
- Add reading logs (start page → end page)
- Add quotes
- Write reflections
- Rating system

### 📊 Dashboard
- Reading statistics
- Books read count
- Pages read total
- Current reading streak
- Average rating
- Calendar heatmap
- Reading activity chart

### 🔐 Authentication
- User registration
- Login/logout
- Protected routes
- JWT token storage

### 🎨 UI/UX
- Dark/Light theme toggle
- Responsive design
- Toast notifications
- Loading states

## 🎨 Theme

Uses CSS variables for theming:

```css
/* Light */
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--primary: 222.2 47.4% 11.2%;

/* Dark */
--background: 222.2 84% 4.9%;
--foreground: 210 40% 98%;
--primary: 210 40% 98%;
```

## 📄 License

MIT
