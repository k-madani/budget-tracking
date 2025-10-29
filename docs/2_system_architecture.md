# Budget Tracker — System Architecture & Technical Design

## 1. Overview

Budget Tracker is a full-stack web application with a decoupled frontend and backend:

- **Frontend:** Next.js + React + Redux Toolkit
- **Backend:** Django REST Framework (DRF) with JWT authentication  
- **Database:** PostgreSQL (via Django ORM)  
- **Documentation:** Swagger (auto-generated API specs)

The system is designed for simplicity, modularity, and quick local deployment.

---

## 2. High-Level Architecture Flow

TBD

**Key Components (Boxes in Diagram):**

1. **Frontend (Next.js + React)**  
   - Pages: Dashboard, Expenses, Categories  
   - State: Redux Toolkit (UI/Auth), React Query (API data)  
   - Charts: Recharts  

2. **Backend (Django REST Framework)**  
   - Endpoints: `/auth/`, `/expenses/`, `/categories/`, `/summary/`  
   - Logic: Serializers + Services + JWT Auth  
   - Docs: Swagger / Redoc  

3. **Database (PostgreSQL)**  
   - Tables: User, Expense, Category, BudgetLimit  
   - Managed via Django ORM  

4. **Data Flow:**  
   - Requests: Frontend → REST API (JSON)  
   - Responses: Backend → JSON summaries / aggregates  
   - Caching: React Query caches fetched data  
   - Authentication: JWT tokens in headers  
   - Visualization: Charts render processed API data  

---

## 3. Data Model (Simplified)

- **User:** id, email, password  
- **Category:** id, user_id, name, color  
- **Expense:** id, user_id, category_id, amount, spent_at  
- **BudgetLimit:** id, user_id, month, amount  

---

## 4. Key Principles

- **Separation of Concerns:** Independent frontend and backend  
- **Scalability:** Stateless API + modular components  
- **Performance:** Cached queries + indexed DB  
- **Security:** JWT auth + per-user data isolation  
- **Maintainability:** Clear folder structure + auto-generated docs  
