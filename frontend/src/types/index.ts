export interface User {
  username: string;
  email: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface Transaction {
  id: string;
  amount: string;
  currency: string;
  note: string;
  spent_at: string;
  category: string;
  category_name: string;
  category_type: 'INCOME' | 'EXPENSE';
  created_at: string;
  updated_at: string;
}

export interface Summary {
  income: number;
  expense: number;
  balance: number;
}