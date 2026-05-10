// User types
export interface User {
  userId: string;
  userName: string;
  email: string;
}

// Auth types
export interface AuthState {
  user: User | null;
  access_token: string | null;
  refresh_token: string | null;
  isAuthenticated: boolean;
}

// Category types
export interface Category {
  categoryId: string;
  categoryName: string;
  categoryType: 'INCOME' | 'EXPENSE';
  userId: string;
}

// Transaction types
export interface Transaction {
  transactionId: string;
  amount: number;
  note: string;
  date: string; // ✅ Added this - it was missing!
  transactionType: 'income' | 'expense';
  category: string; // Category ID
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

// Summary types
export interface Summary {
  balance: number;
  income: number;
  expenses: number;
  transactionCount: number;
}

// API Response types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}