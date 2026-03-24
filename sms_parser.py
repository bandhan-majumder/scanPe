import re

AMOUNT = r'(?:rs|inr|₹)[\s\.:]*([0-9]+(?:\.[0-9]{1,2})?)'

def extract_amount(text):
    text = text.lower().replace(',', '')
    match = re.search(AMOUNT, text)
    if match:
        return float(match.group(1))
    return None

DATE = r'(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})'
TIME = r'(\d{1,2}:\d{2})'

def extract_datetime(text):
    date_match = re.search(DATE, text)
    time_match = re.search(TIME, text)

    date = date_match.group(1) if date_match else None
    time = time_match.group(1) if time_match else None

    return date, time

def detect_type(text):
    text = text.lower()
    if 'debited' in text or 'spent' in text or 'paid' in text or 'dr' in text:
        return 'debit'
    elif 'credited' in text or 'received' in text or 'cr' in text:
        return 'credit'
    return 'unknown'

def parse_sms(sms):
    sms = sms.lower()

    amount = extract_amount(sms)
    date, time = extract_datetime(sms)
    txn_type = detect_type(sms)

    return {"amount": amount, "date": date, "time": time, "type": txn_type}

sms = input("SMS: ")

print(parse_sms(sms))