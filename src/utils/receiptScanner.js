// src/utils/receiptScanner.js
import TextRecognition from '@react-native-ml-kit/text-recognition';

/**
 * FREE Receipt Scanner using Google ML Kit
 * Works offline, no API key needed
 * Accuracy: ~90-95%
 */
export async function scanReceiptWithTesseract(imageUri, onProgress) {
  try {
    console.log('🔍 Starting ML Kit scan...');
    onProgress?.('Analyzing receipt...');

    const result = await TextRecognition.recognize(imageUri);
    
    const extractedText = result.text;
    console.log('📄 Extracted Text:', extractedText);

    if (!extractedText || extractedText.trim().length < 10) {
      throw new Error('Could not read text from image. Please try a clearer photo.');
    }

    onProgress?.('Processing text...');
    return parseReceiptText(extractedText);

  } catch (error) {
    console.error('❌ ML Kit Error:', error);
    throw new Error('Failed to scan receipt: ' + error.message);
  }
}

/**
 * Parse receipt text to extract amount, merchant, items
 */
function parseReceiptText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  console.log('📝 Processing', lines.length, 'lines');

  // ============================================
  // 1. Extract Total Amount
  // ============================================
  let amount = null;
  let confidence = 0;
  let matchedPattern = '';

  const patterns = [
    // Indian receipt patterns
    { regex: /(?:grand\s*total|total\s*amount|net\s*total|bill\s*total)[:\s]*(?:rs\.?|₹|inr\.?)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i, conf: 0.95 },
    { regex: /(?:total)[:\s]*(?:rs\.?|₹|inr\.?)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i, conf: 0.90 },
    { regex: /(?:amount\s*payable|to\s*pay)[:\s]*(?:rs\.?|₹)?\s*(\d+(?:\.\d{2})?)/i, conf: 0.90 },
    { regex: /(?:rs\.?|₹)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:total|only)/i, conf: 0.85 },
    { regex: /₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i, conf: 0.70 },
  ];

  for (const { regex, conf } of patterns) {
    const match = text.match(regex);
    if (match) {
      const rawValue = match[1].replace(/,/g, '');
      const parsedAmount = parseFloat(rawValue);
      
      if (parsedAmount >= 1 && parsedAmount <= 500000) {
        amount = parsedAmount;
        confidence = conf;
        matchedPattern = regex.toString();
        console.log(`✅ Amount: ₹${amount} (confidence: ${conf})`);
        break;
      }
    }
  }

  // Fallback: Find "Total" in lines
  if (!amount) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('total') || line.includes('amount')) {
        const numMatch = lines[i].match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/);
        if (numMatch) {
          const parsed = parseFloat(numMatch[1].replace(/,/g, ''));
          if (parsed >= 10 && parsed <= 500000) {
            amount = parsed;
            confidence = 0.70;
            console.log('⚠️ Amount from line search:', amount);
            break;
          }
        }
      }
    }
  }

  // Last resort: Largest number
  if (!amount) {
    const allNumbers = text.match(/\d+(?:\.\d{2})?/g) || [];
    const numbers = allNumbers
      .map(n => parseFloat(n))
      .filter(n => n >= 10 && n <= 100000)
      .sort((a, b) => b - a);
    
    if (numbers.length > 0) {
      amount = numbers[0];
      confidence = 0.50;
      console.log('⚠️ Using largest number:', amount);
    }
  }

  // ============================================
  // 2. Extract Merchant Name
  // ============================================
  let description = '';
  const skipWords = /receipt|invoice|bill|tax|gst|cgst|sgst|date|time|phone|address|thank/i;
  
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i];
    if (
      line.length >= 3 &&
      line.length <= 40 &&
      /[a-zA-Z]{3,}/.test(line) &&
      !/^\d+$/.test(line) &&
      !skipWords.test(line)
    ) {
      description = line.replace(/[^\w\s&'-]/g, '').trim();
      console.log('✅ Merchant:', description);
      break;
    }
  }

  if (!description || description.length < 3) {
    description = 'Receipt Expense';
  }

  // ============================================
  // 3. Extract Line Items
  // ============================================
  const items = [];
  for (const line of lines) {
    const match = line.match(/^(.{3,35}?)\s+(?:₹|rs\.?)?\s*(\d+(?:\.\d{2})?)$/i);
    if (match) {
      const itemName = match[1].trim();
      const itemPrice = parseFloat(match[2]);
      
      if (
        itemPrice > 0 &&
        itemPrice < (amount || 100000) &&
        !/total|tax|disc/i.test(itemName)
      ) {
        items.push({ name: itemName, price: itemPrice });
      }
    }
  }

  // ============================================
  // 4. Extract Date
  // ============================================
  let date = null;
  const dateMatch = text.match(/(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/);
  if (dateMatch) {
    date = dateMatch[1];
  }

  return {
    amount: amount || 0,
    description: description.substring(0, 50),
    items: items.slice(0, 10),
    date,
    confidence,
    matchedPattern,
    rawText: text,
    success: (amount || 0) > 0,
  };
}

export function formatCurrency(amount, symbol = '₹') {
  if (!amount || isNaN(amount)) return `${symbol}0.00`;
  return `${symbol}${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export function validateReceiptData(data) {
  const errors = [];
  const warnings = [];

  if (!data.amount || data.amount <= 0) {
    errors.push('❌ Could not detect total amount');
  } else if (data.amount > 50000) {
    warnings.push('⚠️ Amount seems high - please verify');
  }

  if (!data.description || data.description === 'Receipt Expense') {
    warnings.push('⚠️ Could not detect merchant name');
  }

  if (data.confidence < 0.7) {
    warnings.push('⚠️ Low confidence - please double-check');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}