
import crypto from 'crypto';

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
    console.log('=== PAYMENT VERIFICATION START ===');
    console.log('Payment data received:', req.body);
    
    const { planKey, razorpay_payment_id, razorpay_order_id, razorpay_signature, userId } = req.body;
    
    // Validate required fields
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      const missing = [];
      if (!razorpay_payment_id) missing.push('razorpay_payment_id');
      if (!razorpay_order_id) missing.push('razorpay_order_id');
      if (!razorpay_signature) missing.push('razorpay_signature');
      
      return res.status(400).json({
        success: false,
        error: `Missing required payment details: ${missing.join(', ')}`
      });
    }

    // Get Razorpay secret from environment
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!RAZORPAY_KEY_SECRET) {
      console.error('❌ Razorpay secret not found in environment');
      return res.status(500).json({
        success: false,
        error: 'Payment verification configuration error'
      });
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      console.error('❌ Payment signature verification failed');
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed - invalid signature'
      });
    }

    console.log('✅ Payment signature verified successfully');
    
    // Here you would typically update the user's subscription in your database
    // For now, we'll return success
    
    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      planKey: planKey || 'pro',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id
    });
    
  } catch (error) {
    console.error('❌ Payment verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Payment verification failed',
      details: error.message
    });
  }
}
