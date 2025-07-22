
export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  
  // Get environment variables
  const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
  const deepaiKey = process.env.DEEPAI_API_KEY || '';
  
  // Return JavaScript config
  const config = `
window.CONFIG = {
    DEEPSEEK_API_KEY: '${deepseekKey}',
    DEEPAI_API_KEY: '${deepaiKey}'
};
`;
  
  res.status(200).send(config);
}
