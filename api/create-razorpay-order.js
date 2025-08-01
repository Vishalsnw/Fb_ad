
import Razorpay from 'razorpay';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    console.log('Creating Razorpay order:', req.body);
    
    const { amount, currency, planKey, userId } = req.body;
    
    // Validate required fields
    if (!planKey || !amount) {
      const missing = [];
      if (!planKey) missing.push('planKey');
      if (!amount) missing.push('amount');
      
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    // Get Razorpay keys from environment
    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error('❌ Razorpay keys not found in environment');
      return res.status(500).json({
        success: false,
        error: 'Payment system configuration error'
      });
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    // Create order with short receipt ID (max 40 chars)
    const receiptId = `rcpt_${Math.random().toString(36).substr(2, 8)}_${Date.now() % 100000}`;
    
    const orderOptions = {
      amount: parseInt(amount), // amount in paise
      currency: currency || 'INR',
      receipt: receiptId,
      notes: {
        planKey: planKey,
        userId: userId
      }
    };

    const order = await razorpay.orders.create(orderOptions);
    
    console.log('✅ Razorpay order created successfully:', order.id);
    
    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      planKey
    });
    
  } catch (error) {
    console.error('❌ Order creation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create order',
      details: error.message
    });
  }
}
