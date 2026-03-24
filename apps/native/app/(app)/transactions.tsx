import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";

import { Container } from "@/components/container";
import { TransactionItem } from "@/components/transaction-item";
import { useTransactions } from "@/lib/api/transactions";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useColorScheme } from "@/lib/theme-provider";

export default function TransactionsScreen() {
	const { colorScheme } = useColorScheme();
	const isDark = colorScheme === "dark";
	const { t } = useI18n();
	const [searchQuery, setSearchQuery] = useState("");

	const { data: transactions, isLoading, error } = useTransactions(100);

	const totalSpent = transactions?.reduce((sum, t) => sum + t.amount, 0) ?? 0;

	const filteredTransactions =
		transactions?.filter((transaction) => {
			const matchesSearch =
				searchQuery === "" ||
				transaction.merchant.toLowerCase().includes(searchQuery.toLowerCase());
			return matchesSearch;
		}) ?? [];

	const getDateStr = (date: Date) => date.toISOString().split("T")[0];

	const groupedTransactions = filteredTransactions.reduce(
		(groups, transaction) => {
			const date = getDateStr(new Date(transaction.createdAt));
			if (!groups[date]) {
				groups[date] = [];
			}
			groups[date].push(transaction);
			return groups;
		},
		{} as Record<string, typeof filteredTransactions>,
	);

	const sortedDates = Object.keys(groupedTransactions).sort(
		(a, b) => new Date(b).getTime() - new Date(a).getTime(),
	);

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		const today = getDateStr(new Date());
		const yesterday = getDateStr(new Date(Date.now() - 86400000));

		if (dateStr === today) {
			return t("transactions.today");
		}
		if (dateStr === yesterday) {
			return t("transactions.yesterday");
		}
		return date.toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		});
	};

	const toDisplayTransaction = (tx: (typeof filteredTransactions)[number]) => {
		const created = new Date(tx.createdAt);
		const today = getDateStr(new Date());
		const yesterday = getDateStr(new Date(Date.now() - 86400000));
		const txDate = getDateStr(created);

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

	return (
		<Container>
			<View
				className={`flex-row items-center justify-between border-b px-4 py-4 ${
					isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"
				}`}
			>
				<TouchableOpacity
					onPress={() => router.back()}
					className={`rounded-full p-2 ${isDark ? "bg-gray-800" : "bg-gray-100"}`}
				>
					<Feather
						name="arrow-left"
						size={20}
						color={isDark ? "#fff" : "#111827"}
					/>
				</TouchableOpacity>

				<Text
					className={`font-bold text-lg ${
						isDark ? "text-white" : "text-gray-900"
					}`}
				>
					{t("transactions.allTransactions")}
				</Text>

				<View className="w-10" />
			</View>

			{isLoading && (
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator size="large" color="#10B981" />
					<Text
						className={`mt-4 text-base ${isDark ? "text-gray-400" : "text-gray-500"}`}
					>
						{t("common.loading")}
					</Text>
				</View>
			)}

			{error && (
				<View className="flex-1 items-center justify-center p-6">
					<Feather name="alert-circle" size={48} color="#EF4444" />
					<Text
						className={`mt-4 text-center text-base ${isDark ? "text-gray-300" : "text-gray-600"}`}
					>
						{error.message || t("common.error")}
					</Text>
				</View>
			)}

			{!isLoading && !error && (
				<ScrollView
					className="flex-1"
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: 100 }}
				>
					{/* Summary Card */}
					<View className="px-6 py-4">
						<View
							className={`rounded-2xl border p-6 ${
								isDark
									? "border-gray-800 bg-gray-900"
									: "border-gray-100 bg-white"
							}`}
						>
							<Text
								className={`mb-1 text-sm ${
									isDark ? "text-gray-400" : "text-gray-500"
								}`}
							>
								{t("transactions.totalSpent")}
							</Text>
							<Text
								className={`font-bold text-3xl ${
									isDark ? "text-white" : "text-gray-900"
								}`}
							>
								${totalSpent.toFixed(2)}
							</Text>
							<Text
								className={`mt-1 text-sm ${
									isDark ? "text-gray-400" : "text-gray-500"
								}`}
							>
								{transactions?.length ?? 0} {t("home.transactions")}
							</Text>
						</View>
					</View>

					{/* Search Bar */}
					<View className="px-6 pb-4">
						<View
							className={`flex-row items-center rounded-xl border-2 px-4 py-3 ${
								isDark
									? "border-gray-700 bg-gray-800"
									: "border-gray-200 bg-gray-50"
							}`}
						>
							<Feather
								name="search"
								size={20}
								color={isDark ? "#6B7280" : "#9CA3AF"}
							/>
							<TextInput
								value={searchQuery}
								onChangeText={setSearchQuery}
								placeholder={t("transactions.searchPlaceholder")}
								placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
								className={`ml-3 flex-1 text-base ${
									isDark ? "text-white" : "text-gray-900"
								}`}
							/>
							{searchQuery !== "" && (
								<TouchableOpacity onPress={() => setSearchQuery("")}>
									<Feather
										name="x"
										size={20}
										color={isDark ? "#6B7280" : "#9CA3AF"}
									/>
								</TouchableOpacity>
							)}
						</View>
					</View>

					{/* Transactions List */}
					<View className="px-6">
						{sortedDates.map((date) => (
							<View key={date} className="mb-6">
								<Text
									className={`mb-3 font-semibold text-sm ${
										isDark ? "text-gray-400" : "text-gray-500"
									}`}
								>
									{formatDate(date)}
								</Text>
								{groupedTransactions[date].map((transaction) => (
									<TransactionItem
										key={transaction.id}
										transaction={toDisplayTransaction(transaction)}
										isDark={isDark}
									/>
								))}
							</View>
						))}

						{filteredTransactions.length === 0 && (
							<View className="items-center justify-center py-12">
								<Feather
									name="search"
									size={48}
									color={isDark ? "#374151" : "#D1D5DB"}
								/>
								<Text
									className={`mt-4 text-center ${
										isDark ? "text-gray-400" : "text-gray-500"
									}`}
								>
									{t("transactions.noTransactions")}
								</Text>
							</View>
						)}
					</View>
				</ScrollView>
			)}
		</Container>
	);
}
