export interface ParsedSms {
	amount: number | null;
	date: string | null;
	time: string | null;
	type: "debit" | "credit" | "unknown";
}

const AMOUNT_RE = /(?:rs|inr|₹)[\s.:]*([0-9]+(?:\.[0-9]{1,2})?)/i;
const DATE_RE = /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
const TIME_RE = /(\d{1,2}:\d{2})/;

function extractAmount(text: string): number | null {
	const normalized = text.toLowerCase().replace(/,/g, "");
	const match = normalized.match(AMOUNT_RE);
	if (match?.[1]) {
		return Number.parseFloat(match[1]);
	}
	return null;
}

function extractDateTime(text: string): {
	date: string | null;
	time: string | null;
} {
	const dateMatch = text.match(DATE_RE);
	const timeMatch = text.match(TIME_RE);
	return {
		date: dateMatch?.[1] ?? null,
		time: timeMatch?.[1] ?? null,
	};
}

function detectType(text: string): ParsedSms["type"] {
	const lower = text.toLowerCase();

	if (
		lower.includes("debited") ||
		lower.includes("spent") ||
		lower.includes("paid") ||
		lower.includes(" dr")
	) {
		return "debit";
	}

	if (
		lower.includes("credited") ||
		lower.includes("received") ||
		lower.includes(" cr")
	) {
		return "credit";
	}

	return "unknown";
}

export function parseSms(sms: string): ParsedSms {
	const amount = extractAmount(sms);
	const { date, time } = extractDateTime(sms);
	const type = detectType(sms);

	return { amount, date, time, type };
}

export function isPaymentSms(sms: string): boolean {
	const parsed = parseSms(sms);
	return parsed.amount !== null && parsed.type !== "unknown";
}
