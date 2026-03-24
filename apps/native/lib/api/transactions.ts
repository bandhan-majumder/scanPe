import { env } from "@scanPe/env/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	CreateTransactionInput,
	Transaction,
} from "../../types/transaction";
import { authClient } from "../auth-client";

const API_URL = env.EXPO_PUBLIC_SERVER_URL;

async function getAuthToken(): Promise<string | null> {
	const session = await authClient.getSession();
	if (session?.data?.session?.token) {
		return session.data.session.token;
	}
	return null;
}

async function fetchTransactions(limit = 50): Promise<Transaction[]> {
	const token = await getAuthToken();
	if (!token) {
		throw new Error("Not authenticated");
	}

	const response = await fetch(`${API_URL}/transactions?limit=${limit}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		if (response.status === 401) {
			throw new Error("Unauthorized. Please sign in again.");
		}
		const error = await response
			.json()
			.catch(() => ({ error: "Unknown error" }));
		throw new Error(error.error || "Failed to fetch transactions");
	}

	return response.json();
}

async function createTransaction(
	input: CreateTransactionInput,
): Promise<Transaction> {
	const token = await getAuthToken();
	if (!token) {
		throw new Error("Not authenticated");
	}

	const response = await fetch(`${API_URL}/transactions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(input),
	});

	if (!response.ok) {
		if (response.status === 401) {
			throw new Error("Unauthorized. Please sign in again.");
		}
		const error = await response
			.json()
			.catch(() => ({ error: "Unknown error" }));
		throw new Error(error.error || "Failed to create transaction");
	}

	return response.json();
}

export function useTransactions(limit = 50) {
	return useQuery({
		queryKey: ["transactions", limit],
		queryFn: () => fetchTransactions(limit),
		enabled: true,
		retry: (failureCount, error) => {
			if (error instanceof Error && error.message.includes("Unauthorized")) {
				return false;
			}
			return failureCount < 3;
		},
	});
}

export function useCreateTransaction() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createTransaction,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
		},
	});
}
