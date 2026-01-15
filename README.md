# Budgetly

A full-stack budget tracking application with intelligent transaction categorization, analytics, and gamification features. Built with Django REST Framework and Next.js.

## Features

- Auto-categorized transaction tracking with manual override
- Budget goals and spending analytics with interactive charts
- Gamification system with points and achievements
- JWT-based authentication
- Data export functionality
- Responsive UI with Tailwind CSS and shadcn/ui

## Tech Stack

**Backend:** Django 4.2, Django REST Framework, PostgreSQL, JWT Authentication

**Frontend:** Next.js 14, TypeScript, Tailwind CSS, Recharts, shadcn/ui

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 14+

### Installation

1. Clone the repository

```bash
git clone https://github.com/k-madani/budget-tracking.git
cd budget-tracking
```

2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Frontend setup

```bash
cd frontend
npm install
```

### Configuration

Create `.env` in `backend/`:
```env
SECRET_KEY=your-secret-key
DEBUG=True
DB_NAME=budgetly_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

Create `.env.local` in `frontend/`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Database Setup
```bash
psql -U postgres
CREATE DATABASE budgetly_db;
\q

cd backend
python manage.py migrate
python manage.py createsuperuser  # Optional
```

### Run the Application

Backend:
```bash
cd backend
python manage.py runserver
```

Frontend (in new terminal):
```bash
cd frontend
npm run dev
```

Access the app at `http://localhost:3000`

## Project Structure

```
budget-tracking/
├── backend/
│   ├── budgetapi/
│   │   ├── accounts/          # User authentication
│   │   ├── budgets/           # Budget management
│   │   ├── gamification/      # Points & achievements
│   │   ├── logs/              # Activity logging
│   │   └── transactions/      # Transaction handling
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js app router
│   │   ├── components/       # React components
│   │   ├── lib/              # Utility functions
│   │   └── types/            # TypeScript definitions
│   ├── next.config.ts
│   └── package.json
└── docs/
```

## Key Commands

**Backend:**
```bash
python manage.py test              # Run tests
python manage.py makemigrations    # Create migrations
python manage.py migrate           # Apply migrations
```

**Frontend:**
```bash
npm run build      # Production build
```
