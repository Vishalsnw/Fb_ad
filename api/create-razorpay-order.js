
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
    
    const { planKey, planName, price, currency } = req.body;
    
    // Validate required fields
    if (!planKey || !price) {
      const missing = [];
      if (!planKey) missing.push('planKey');
      if (!price) missing.push('price');
      
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    // Generate mock order ID
    const orderId = `order_${Math.random().toString(36).substr(2, 12)}`;
    
    console.log('✅ Order created successfully:', orderId);
    
    return res.status(200).json({
      success: true,
      order_id: orderId,
      amount: parseInt(price),
      currency: currency || 'INR',
      planKey
    });
    
  } catch (error) {
    console.error('Order creation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create order',
      details: error.message
    });
  }
}
