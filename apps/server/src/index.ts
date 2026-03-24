import { devToolsMiddleware } from "@ai-sdk/devtools";
import { google } from "@ai-sdk/google";
import { auth } from "@scanPe/auth";
import prisma from "@scanPe/db";
import { env } from "@scanPe/env/server";
import { generateText, wrapLanguageModel } from "ai";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import { z } from "zod";

const app = express();

app.use(
	cors({
		origin: env.CORS_ORIGIN,
		methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.all("/api/auth{/*path}", toNodeHandler(auth));

app.use(express.json());

// System prompt for scanPe support assistant
const SYSTEM_PROMPT = `You are a helpful support assistant for scanPe, a mobile budgeting and QR payment app.

Your role is to help users with:

1. BUDGET MANAGEMENT:
   - How daily and monthly budgets work
   - Setting up budget limits (go to Budgets tab, use sliders)
   - Understanding spending alerts when you exceed 60% of budget
   - What happens when you're out of budget (Strict Mode blocks payments)
   - How to check current budget (Home screen shows circular chart)
   - Daily vs Monthly budget differences

2. PAYMENTS & QR SCANNING:
   - How to scan QR codes (tap center Scan button)
   - What happens during a scan (3-second recognition, payment preview)
   - How payments affect your budget (shown before confirming)
   - Transaction history and recent activity

3. APP FEATURES:
   - Home dashboard: Budget ring, spending alerts, recent transactions
   - Budget tab: Set limits, view progress bars, enable Strict Mode
   - Profile: Edit info, change theme (Light/Dark/System), get help
   - Theme switching and app customization

4. STRICT MODE:
   - What it does (prevents payments when budget exceeded)
   - How to enable/disable it (Budget tab toggle)
   - Why you might want it (avoid overspending)

5. TROUBLESHOOTING:
   - QR code not scanning (ensure good lighting, hold steady)
   - Budget not updating (pull down to refresh)
   - App performance issues (restart app, check internet)
   - Login problems (check credentials, use Sign Out and back in)

Keep responses concise (2-4 sentences), friendly, and actionable. Use emojis occasionally for warmth. If you don't know something specific, suggest contacting support@scanpe.app.

Current features available:
✓ Budget dashboard with circular progress chart
✓ Daily/Monthly budget toggles
✓ Spending alerts when >60% budget used
✓ QR code scanning for payments
✓ Transaction history with merchant details
✓ Dark/Light/System theme support
✓ Strict mode to prevent over-budget spending`;

// Simple message format from frontend
interface SimpleMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
}

app.post("/ai", async (req, res) => {
	try {
		const { messages = [] } = (req.body || {}) as { messages: SimpleMessage[] };

		if (!messages.length) {
			return res.status(400).json({ error: "No messages provided" });
		}

		// Find the last user message
		const lastUserMessage = [...messages]
			.reverse()
			.find((m) => m.role === "user");

		if (!lastUserMessage) {
			return res.status(400).json({ error: "No user message found" });
		}

		// Create conversation history for context
		const conversationHistory = messages
			.filter((m) => m.role === "user" || m.role === "assistant")
			.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
			.join("\n");

		// Prepare the prompt with system context and conversation
		const prompt = `${SYSTEM_PROMPT}\n\nConversation History:\n${conversationHistory}\n\nPlease provide a helpful response to the user's last question.`;

		const model = wrapLanguageModel({
			model: google("gemini-2.5-flash"),
			middleware: devToolsMiddleware(),
		});

		const result = await generateText({
			model,
			prompt: prompt,
		});

		// Return simple JSON response
		res.json({
			role: "assistant",
			content: result.text,
		});
	} catch (error) {
		console.error("[AI] Error:", error);
		res.status(500).json({
			error: "Failed to generate response",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

// Auth middleware to get current user from Bearer token
const authMiddleware = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res
				.status(401)
				.json({ error: "Unauthorized - No token provided" });
		}

		const token = authHeader.substring(7); // Remove "Bearer " prefix

		// Find session in database by token
		const session = await prisma.session.findUnique({
			where: { token },
			include: { user: true },
		});

		if (!session) {
			return res.status(401).json({ error: "Unauthorized - Invalid token" });
		}

		// Check if session is expired
		if (new Date() > session.expiresAt) {
			return res.status(401).json({ error: "Unauthorized - Session expired" });
		}

		(req as any).user = session.user;
		next();
	} catch (error) {
		console.error("[Auth] Error:", error);
		return res.status(401).json({ error: "Unauthorized" });
	}
};

// Category API Routes

// Get all categories (default + user-created)
app.get("/categories", authMiddleware, async (req, res) => {
	try {
		const user = (req as any).user;
		const categories = await prisma.category.findMany({
			where: {
				OR: [{ isDefault: true }, { userId: user.id }],
			},
			orderBy: [{ isDefault: "desc" }, { name: "asc" }],
		});
		res.json(categories);
	} catch (error) {
		console.error("[Categories] Error fetching categories:", error);
		res.status(500).json({ error: "Failed to fetch categories" });
	}
});

// Create custom category
const createCategorySchema = z.object({
	name: z.string().min(1).max(50),
	icon: z.string().optional(),
	color: z.string().optional(),
});

app.post("/categories", authMiddleware, async (req, res) => {
	try {
		const user = (req as any).user;
		const result = createCategorySchema.safeParse(req.body);

		if (!result.success) {
			return res.status(400).json({
				error: "Invalid input",
				details: result.error.issues,
			});
		}

		const { name, icon, color } = result.data;

		// Check if category with same name already exists
		const existingCategory = await prisma.category.findFirst({
			where: {
				name,
				OR: [{ isDefault: true }, { userId: user.id }],
			},
		});

		if (existingCategory) {
			return res.status(409).json({
				error: "A category with this name already exists",
			});
		}

		const category = await prisma.category.create({
			data: {
				name,
				icon: icon || "folder",
				color: color || "#10B981",
				userId: user.id,
				isDefault: false,
			},
		});

		res.status(201).json(category);
	} catch (error) {
		console.error("[Categories] Error creating category:", error);
		res.status(500).json({ error: "Failed to create category" });
	}
});

// Delete custom category
app.delete("/categories/:id", authMiddleware, async (req, res) => {
	try {
		const user = (req as any).user;
		const { id } = req.params as { id: string };

		// Verify category belongs to user and is not a default category
		const category = await prisma.category.findFirst({
			where: { id, userId: user.id, isDefault: false },
		});

		if (!category) {
			return res
				.status(404)
				.json({ error: "Category not found or cannot be deleted" });
		}

		// Check if any budgets use this category
		const budgetsUsingCategory = await prisma.budget.count({
			where: { categoryId: id },
		});

		if (budgetsUsingCategory > 0) {
			return res.status(400).json({
				error: "Cannot delete category that has associated budgets",
			});
		}

		await prisma.category.delete({
			where: { id },
		});

		res.status(204).send();
	} catch (error) {
		console.error("[Categories] Error deleting category:", error);
		res.status(500).json({ error: "Failed to delete category" });
	}
});

// Budget API Routes

// Validation schemas
const createBudgetSchema = z.object({
	categoryId: z.string(),
	limit: z.number().positive(),
	period: z.enum(["daily", "monthly", "yearly"]),
	strictMode: z.boolean().default(false),
});

const updateBudgetSchema = z.object({
	limit: z.number().positive().optional(),
	period: z.enum(["daily", "monthly", "yearly"]).optional(),
	strictMode: z.boolean().optional(),
});

// Get all budgets for current user with category info
app.get("/budgets", authMiddleware, async (req, res) => {
	try {
		const user = (req as any).user;
		const budgets = await prisma.budget.findMany({
			where: { userId: user.id },
			include: { category: true },
			orderBy: { createdAt: "desc" },
		});

		// Calculate spent from transactions for each budget
		const budgetsWithSpent = await Promise.all(
			budgets.map(async (budget: any) => {
				const transactions = await prisma.transaction.findMany({
					where: { budgetId: budget.id },
				});
				const spent = transactions.reduce(
					(sum: number, t: any) => sum + Number(t.amount),
					0,
				);
				return {
					...budget,
					spent,
					limit: Number(budget.limit),
				};
			}),
		);

		res.json(budgetsWithSpent);
	} catch (error) {
		console.error("[Budgets] Error fetching budgets:", error);
		res.status(500).json({ error: "Failed to fetch budgets" });
	}
});

// Create a new budget
app.post("/budgets", authMiddleware, async (req, res) => {
	try {
		const user = (req as any).user;
		const result = createBudgetSchema.safeParse(req.body);

		if (!result.success) {
			return res.status(400).json({
				error: "Invalid input",
				details: result.error.issues,
			});
		}

		const { categoryId, limit, period, strictMode } = result.data;

		// Verify category exists and user has access to it
		const category = await prisma.category.findFirst({
			where: {
				id: categoryId,
				OR: [{ isDefault: true }, { userId: user.id }],
			},
		});

		if (!category) {
			return res.status(404).json({ error: "Category not found" });
		}

		// Check if budget for this category and period already exists
		const existingBudget = await prisma.budget.findFirst({
			where: { userId: user.id, categoryId, period },
		});

		if (existingBudget) {
			return res.status(409).json({
				error: "A budget for this category and period already exists",
			});
		}

		const budget = await prisma.budget.create({
			data: {
				userId: user.id,
				categoryId,
				limit,
				period,
				strictMode,
			},
			include: { category: true },
		});

		res.status(201).json({
			...budget,
			spent: 0,
			limit: Number(budget.limit),
		});
	} catch (error) {
		console.error("[Budgets] Error creating budget:", error);
		res.status(500).json({ error: "Failed to create budget" });
	}
});

// Update a budget
app.patch("/budgets/:id", authMiddleware, async (req, res) => {
	try {
		const user = (req as any).user;
		const { id } = req.params as { id: string };
		const result = updateBudgetSchema.safeParse(req.body);

		if (!result.success) {
			return res.status(400).json({
				error: "Invalid input",
				details: result.error.issues,
			});
		}

		// Verify budget belongs to user
		const existingBudget = await prisma.budget.findFirst({
			where: { id, userId: user.id },
			include: { category: true },
		});

		if (!existingBudget) {
			return res.status(404).json({ error: "Budget not found" });
		}

		// Check for duplicate if period is being changed
		if (result.data.period && result.data.period !== existingBudget.period) {
			const duplicateBudget = await prisma.budget.findFirst({
				where: {
					userId: user.id,
					categoryId: existingBudget.categoryId,
					period: result.data.period,
					NOT: { id },
				},
			});

			if (duplicateBudget) {
				return res.status(409).json({
					error: "A budget for this category and period already exists",
				});
			}
		}

		const budget = await prisma.budget.update({
			where: { id },
			data: result.data,
			include: { category: true },
		});

		// Calculate spent
		const transactions = await prisma.transaction.findMany({
			where: { budgetId: id },
		});
		const spent = transactions.reduce(
			(sum: number, t: any) => sum + Number(t.amount),
			0,
		);

		res.json({
			...budget,
			spent,
			limit: Number(budget.limit),
		});
	} catch (error) {
		console.error("[Budgets] Error updating budget:", error);
		res.status(500).json({ error: "Failed to update budget" });
	}
});

// Delete a budget
app.delete("/budgets/:id", authMiddleware, async (req, res) => {
	try {
		const user = (req as any).user;
		const { id } = req.params as { id: string };

		// Verify budget belongs to user
		const existingBudget = await prisma.budget.findFirst({
			where: { id, userId: user.id },
		});

		if (!existingBudget) {
			return res.status(404).json({ error: "Budget not found" });
		}

		await prisma.budget.delete({
			where: { id },
		});

		res.status(204).send();
	} catch (error) {
		console.error("[Budgets] Error deleting budget:", error);
		res.status(500).json({ error: "Failed to delete budget" });
	}
});

// Transaction API Routes

const createTransactionSchema = z.object({
	amount: z.number().positive(),
	merchant: z.string().min(1).max(200),
	description: z.string().max(500).optional(),
	categoryId: z.string(),
	budgetId: z.string().optional(),
});

// Get all transactions for current user
app.get("/transactions", authMiddleware, async (req, res) => {
	try {
		const user = (req as any).user;
		const rawLimit = req.query.limit;
		const limitValue =
			typeof rawLimit === "string"
				? rawLimit
				: Array.isArray(rawLimit)
					? (rawLimit[0] as string)
					: undefined;
		const limit = limitValue
			? Math.min(Number.parseInt(limitValue, 10), 100)
			: 50;

		const transactions = await prisma.transaction.findMany({
			where: { userId: user.id },
			include: {
				budget: {
					include: { category: true },
				},
			},
			orderBy: { createdAt: "desc" },
			take: limit,
		});

		res.json(
			transactions.map((t: any) => ({
				...t,
				amount: Number(t.amount),
			})),
		);
	} catch (error) {
		console.error("[Transactions] Error fetching transactions:", error);
		res.status(500).json({ error: "Failed to fetch transactions" });
	}
});

// Create a new transaction
app.post("/transactions", authMiddleware, async (req, res) => {
	try {
		const user = (req as any).user;
		const result = createTransactionSchema.safeParse(req.body);

		if (!result.success) {
			return res.status(400).json({
				error: "Invalid input",
				details: result.error.issues,
			});
		}

		const { amount, merchant, description, categoryId, budgetId } = result.data;

		// If budgetId provided, verify it belongs to user
		if (budgetId) {
			const budget = await prisma.budget.findFirst({
				where: { id: budgetId, userId: user.id },
			});

			if (!budget) {
				return res.status(404).json({ error: "Budget not found" });
			}
		} else {
			// If no budgetId, find a budget matching the category (if any)
			const budget = await prisma.budget.findFirst({
				where: { userId: user.id, categoryId },
				orderBy: { createdAt: "desc" },
			});
			if (budget) {
				// Use this budget for the transaction
			}
		}

		const transaction = await prisma.transaction.create({
			data: {
				userId: user.id,
				budgetId: budgetId || null,
				amount,
				merchant,
				description: description || null,
			},
			include: {
				budget: {
					include: { category: true },
				},
			},
		});

		res.status(201).json({
			...transaction,
			amount: Number(transaction.amount),
		});
	} catch (error) {
		console.error("[Transactions] Error creating transaction:", error);
		res.status(500).json({ error: "Failed to create transaction" });
	}
});

app.get("/", (_req, res) => {
	res.status(200).send("OK");
});

app.listen(3000, () => {
	console.log("Server is running on http://localhost:3000");
});
