import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
	FlatList,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

import { BudgetChart } from "@/components/budget-chart";
import { Container } from "@/components/container";
import { SpendingAlert } from "@/components/spending-alert";
import { TransactionItem } from "@/components/transaction-item";
import { useBudgets } from "@/lib/api/budgets";
import { useTransactions } from "@/lib/api/transactions";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useColorScheme } from "@/lib/theme-provider";
import { DEFAULT_AVATAR } from "./profile";

const toDisplayTransaction = (
	tx: {
		id: string;
		merchant: string;
		amount: number;
		createdAt: string;
		budget?: {
			category?: { name?: string; icon?: string; color?: string };
		} | null;
	},
	t: (key: string) => string,
) => {
	const created = new Date(tx.createdAt);
	const today = new Date().toISOString().split("T")[0];
	const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
	const txDate = created.toISOString().split("T")[0];

	let time = created.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
	});
	if (txDate === today) {
		time = `${t("transactions.today")}, ${time}`;
	} else if (txDate === yesterday) {
		time = `${t("transactions.yesterday")}, ${time}`;
	} else {
		time = `${created.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
	}

	return {
		id: tx.id,
		merchant: tx.merchant,
		category: tx.budget?.category?.name ?? "Others",
		amount: tx.amount,
		time,
		icon: tx.budget?.category?.icon ?? "more-horizontal",
		iconColor: tx.budget?.category?.color ?? "#6B7280",
		iconBgColor: `${tx.budget?.category?.color ?? "#6B7280"}20`,
	};
};

export default function Home() {
	const { colorScheme } = useColorScheme();
	const isDark = colorScheme === "dark";
	const { data: session } = authClient.useSession();
	const { t } = useI18n();
	const [period, setPeriod] = useState<"daily" | "monthly" | "yearly">("daily");

	// Get actual user data from session
	const userName = session?.user?.name || "User";
	const userImage = session?.user?.image || DEFAULT_AVATAR;

	// Fetch real budget data from API
	const { data: budgets } = useBudgets();
	const { data: apiTransactions } = useTransactions(5);

	// Map API transactions to display format
	const recentTransactions =
		apiTransactions?.map((tx) => toDisplayTransaction(tx, t)) ?? [];

	// Calculate totals for the selected period across all categories
	const periodBudgets = budgets?.filter((b) => b.period === period) || [];
	const totalSpent = periodBudgets.reduce((sum, b) => sum + b.spent, 0);
	const totalLimit = periodBudgets.reduce((sum, b) => sum + b.limit, 0);

	// Get current budget based on selected period, fallback to defaults if no budget exists
	const currentBudget =
		totalLimit > 0
			? { spent: totalSpent, total: totalLimit }
			: { spent: 0, total: 100 };
	const percentage =
		currentBudget.total > 0
			? Math.round((currentBudget.spent / currentBudget.total) * 100)
			: 0;

	// Get greeting based on local time
	const getGreeting = () => {
		const hour = new Date().getHours();
		if (hour < 12) return t("home.goodMorning");
		if (hour < 18) return t("home.goodAfternoon");
		return t("home.goodEvening");
	};

	return (
		<Container>
			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 100 }}
			>
				{/* Header Section */}
				<View className="flex-row items-center justify-between p-6 pb-4">
					<View>
						<Text
							className={`text-base ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							{getGreeting()},
						</Text>
						<Text
							className={`font-bold text-2xl ${isDark ? "text-white" : "text-gray-900"}`}
						>
							{userName}
						</Text>
					</View>
					<TouchableOpacity
						onPress={() => router.push("/(app)/profile")}
						className="h-12 w-12 overflow-hidden rounded-full border-2 border-emerald-500"
					>
						<Image
							source={{
								uri: userImage,
							}}
							style={{ width: 48, height: 48 }}
							contentFit="cover"
						/>
					</TouchableOpacity>
				</View>

				{/* Budget Circle Chart */}
				<View className="items-center px-6 py-4">
					<BudgetChart
						spent={currentBudget.spent}
						total={currentBudget.total}
						period={period}
						onPeriodChange={setPeriod}
						isDark={isDark}
					/>
				</View>

				{/* Spending Alert */}
				<SpendingAlert percentage={percentage} isDark={isDark} />

				{/* Recent Activity Section */}
				<View className="px-6">
					{/* Section Header */}
					<View className="mb-4 flex-row items-center justify-between">
						<Text
							className={`font-bold text-xl ${isDark ? "text-white" : "text-gray-900"}`}
						>
							{t("home.recentActivity")}
						</Text>
						<TouchableOpacity
							onPress={() => router.push("/(app)/transactions")}
						>
							<Text className="font-medium text-emerald-500">
								{t("home.viewAll")}
							</Text>
						</TouchableOpacity>
					</View>

					{/* Transaction List */}
					<FlatList
						data={recentTransactions}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => (
							<TransactionItem transaction={item} isDark={isDark} />
						)}
						scrollEnabled={false}
					/>
				</View>
			</ScrollView>
		</Container>
	);
}
