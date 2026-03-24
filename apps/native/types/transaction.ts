import type { Category } from "./category";

export interface Transaction {
	id: string;
	userId: string;
	budgetId?: string | null;
	budget?: {
		id: string;
		category: Category;
	} | null;
	amount: number;
	merchant: string;
	description?: string | null;
	createdAt: string;
}

export interface CreateTransactionInput {
	amount: number;
	merchant: string;
	description?: string;
	categoryId: string;
	budgetId?: string;
}
