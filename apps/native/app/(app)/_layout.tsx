import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, Tabs } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Alert, Platform, TouchableOpacity, View } from "react-native";
import { useCreateTransaction } from "@/lib/api/transactions";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { startSmsListener, stopSmsListener } from "@/lib/sms-listener";
import { useColorScheme } from "@/lib/theme-provider";

// ID of the default "Others" category (from seed data)
const OTHERS_CATEGORY_ID = "others";

export default function AppLayout() {
	const { isDarkColorScheme } = useColorScheme();
	const theme = isDarkColorScheme ? NAV_THEME.dark : NAV_THEME.light;
	const { data: session, isPending } = authClient.useSession();
	const { t } = useI18n();
	const createTransaction = useCreateTransaction();
	const queryClient = useQueryClient();
	const hasStartedRef = useRef(false);

	const handleSmsTransaction = useCallback(
		(data: { amount: number; merchant: string; description: string }) => {
			if (Platform.OS !== "android") return;

			createTransaction.mutate(
				{
					amount: data.amount,
					merchant: data.merchant.slice(0, 200),
					description: data.description,
					categoryId: OTHERS_CATEGORY_ID,
				},
				{
					onSuccess: () => {
						queryClient.invalidateQueries({ queryKey: ["transactions"] });
						Alert.alert(
							t("sms.transactionAdded"),
							`₹${data.amount.toFixed(2)}`,
						);
					},
				},
			);
		},
		[createTransaction, queryClient, t],
	);

	useEffect(() => {
		if (session?.user && !hasStartedRef.current && Platform.OS === "android") {
			hasStartedRef.current = true;
			const started = startSmsListener(handleSmsTransaction);
			if (started) {
				console.log("[App] SMS listener started");
			}
		}

		return () => {
			if (hasStartedRef.current) {
				stopSmsListener();
				hasStartedRef.current = false;
			}
		};
	}, [session?.user, handleSmsTransaction]);

	if (isPending) {
		return null;
	}

	if (!session?.user) {
		return <Redirect href="/(auth)" />;
	}

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarShowLabel: false,
				headerStyle: {
					backgroundColor: theme.background,
				},
				headerTitleStyle: {
					color: theme.text,
				},
				headerTintColor: theme.text,
				tabBarActiveTintColor: "#10B981",
				tabBarInactiveTintColor: isDarkColorScheme ? "#6B7280" : "#9CA3AF",
				tabBarStyle: {
					backgroundColor: theme.background,
					borderTopColor: theme.border,
					height: 80,
					paddingBottom: 20,
					paddingTop: 10,
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					tabBarIcon: ({ color, size }) => (
						<Feather name="home" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="scan"
				options={{
					title: "",
					tabBarIcon: ({ size }) => (
						<View
							style={{
								width: 56,
								height: 56,
								borderRadius: 28,
								backgroundColor: "#10B981",
								justifyContent: "center",
								alignItems: "center",
								marginTop: -30,
								shadowColor: "#10B981",
								shadowOffset: { width: 0, height: 4 },
								shadowOpacity: 0.3,
								shadowRadius: 8,
								elevation: 8,
								borderWidth: 4,
								borderColor: theme.background,
							}}
						>
							<Feather name="maximize" size={24} color="white" />
						</View>
					),
				}}
			/>
			<Tabs.Screen
				name="budgets"
				options={{
					title: "Budgets",
					tabBarIcon: ({ color, size }) => (
						<Feather name="credit-card" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					href: null,
				}}
			/>
			<Tabs.Screen
				name="support"
				options={{
					href: null,
				}}
			/>
			<Tabs.Screen
				name="transactions"
				options={{
					href: null,
				}}
			/>
		</Tabs>
	);
}
