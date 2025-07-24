
export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  
  // Get environment variables
  const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
  const deepaiKey = process.env.DEEPAI_API_KEY || '';
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const firebaseApiKey = process.env.FIREBASE_API_KEY || '';
  const firebaseAuthDomain = process.env.FIREBASE_AUTH_DOMAIN || '';
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || '';
  
  // Return JavaScript config
  const config = `
window.CONFIG = {
    DEEPSEEK_API_KEY: '${deepseekKey}',
    DEEPAI_API_KEY: '${deepaiKey}',
    GOOGLE_CLIENT_ID: '${googleClientId}',
    RAZORPAY_KEY_ID: '${razorpayKeyId}',
    RAZORPAY_KEY_SECRET: '${razorpayKeySecret}',
    FIREBASE_API_KEY: '${firebaseApiKey}',
    FIREBASE_AUTH_DOMAIN: '${firebaseAuthDomain}',
    FIREBASE_PROJECT_ID: '${firebaseProjectId}'
};
`;
  
  res.status(200).send(config);
}
