import { Platform } from "react-native";

import { isPaymentSms, parseSms } from "./sms-parser";

type TransactionCallback = (data: {
	amount: number;
	merchant: string;
	description: string;
}) => void;

let isListening = false;
let onTransactionCallback: TransactionCallback | null = null;

function getSmsModule() {
	if (Platform.OS !== "android") return null;
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		return require("react-native-get-sms-android");
	} catch {
		console.warn("[SMS] react-native-get-sms-android not available");
		return null;
	}
}

export function startSmsListener(callback: TransactionCallback): boolean {
	if (Platform.OS !== "android") {
		console.log("[SMS] SMS listening is only available on Android");
		return false;
	}

	if (isListening) {
		console.log("[SMS] Already listening");
		return true;
	}

	const SmsAndroid = getSmsModule();
	if (!SmsAndroid) {
		console.warn("[SMS] Native module not available");
		return false;
	}

	onTransactionCallback = callback;
	isListening = true;

	const filter = {
		box: "inbox",
		maxCount: 1,
	};

	SmsAndroid.startWatch(
		JSON.stringify(filter),
		(fail: string) => {
			console.error("[SMS] Failed to start watching:", fail);
			isListening = false;
		},
		(json: string) => {
			try {
				const messages = JSON.parse(json);
				if (!Array.isArray(messages) || messages.length === 0) return;

				for (const msg of messages) {
					const body = msg.body as string | undefined;
					if (!body) continue;

					if (isPaymentSms(body)) {
						const parsed = parseSms(body);
						if (parsed.amount && onTransactionCallback) {
							console.log(
								`[SMS] Payment detected: ₹${parsed.amount} (${parsed.type})`,
							);
							onTransactionCallback({
								amount: parsed.amount,
								merchant: body.slice(0, 200),
								description: `Auto-detected from SMS: ${body.slice(0, 100)}`,
							});
						}
					}
				}
			} catch (err) {
				console.error("[SMS] Error parsing message:", err);
			}
		},
	);

	console.log("[SMS] Listener started");
	return true;
}

export function stopSmsListener(): void {
	if (!isListening) return;

	const SmsAndroid = getSmsModule();
	if (SmsAndroid) {
		try {
			SmsAndroid.stopWatch();
		} catch {
			// ignore
		}
	}

	isListening = false;
	onTransactionCallback = null;
	console.log("[SMS] Listener stopped");
}

export function isSmsListening(): boolean {
	return isListening;
}
