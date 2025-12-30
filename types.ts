export type Category = string;

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: Category;
  merchant: string;
  note: string;
  date: string; // ISO string
  type: 'expense' | 'income';
  isFixed?: boolean; // Represents recurring items contributing to Fixed expenses
}

export interface Budget {
  category: Category;
  limit: number;
  spent: number;
}

export interface UserStats {
  streak: number;
  xp: number;
  level: number;
  lastActiveDate: string;
  badges: string[];
}

export interface AIInsight {
  title: string;
  content: string;
  type: 'warning' | 'tip' | 'praise';
}