export type OperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

export type TransactionType = 'income' | 'expense' | 'both';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  parentId?: string | null;
  isStarred?: boolean;
  userId: string;
  savingsBucket?: 'necessities' | 'entertainment' | 'investments' | 'unassigned' | 'income' | null;
}

export type RuleField = 'recipient' | 'description';

export interface RuleCondition {
  field: RuleField;
  pattern: string;
}

export interface Rule {
  id: string;
  categoryId: string;
  userId: string;
  conditions: RuleCondition[];
  pattern?: string; // Legacy support
}

export interface Transaction {
  id: string;
  date: string; // ISO format
  amount: number;
  recipient: string;
  description: string;
  categoryId?: string | null;
  userId: string;
  rawLine?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string; // YYYY-MM
  amount: number;
  userId: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  createdAt: string;
}
