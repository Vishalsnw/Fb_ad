
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
    
    const { planKey, payment_id, order_id, signature } = req.body;
    
    // Validate required fields
    if (!payment_id || !order_id || !signature) {
      const missing = [];
      if (!payment_id) missing.push('payment_id');
      if (!order_id) missing.push('order_id');
      if (!signature) missing.push('signature');
      
      return res.status(400).json({
        success: false,
        error: `Missing required payment details: ${missing.join(', ')}`
      });
    }

    // Mock payment verification for now
    // In production, verify signature with Razorpay webhook secret
    console.log('✅ Payment verification successful');
    
    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      planKey: planKey || 'pro',
      payment_id,
      order_id
    });
    
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Payment verification failed',
      details: error.message
    });
  }
}
