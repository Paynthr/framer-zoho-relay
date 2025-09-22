// api/framer-to-zoho-flow.js
export default async function handler(req, res) {
  // Set CORS headers to allow requests from Framer
  const allowedOrigins = [
    'https://framer.com',
    'https://framer.website',
    'https://framerusercontent.com'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.some(allowed => origin && origin.endsWith(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Fallback for testing
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Framer-Signature, Framer-Webhook-Submission-Id');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only allow POST requests for actual webhook data
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    // Get the form data from Framer
    const formData = req.body;
    
    // Log the incoming data for debugging
    console.log('Received form data:', formData);
    
    // Optional: Verify the webhook signature if you've set up a secret
    // const signature = req.headers['framer-signature'];
    // const submissionId = req.headers['framer-webhook-submission-id'];
    // if (!verifySignature(formData, signature, submissionId)) {
    //   res.status(401).json({ error: 'Invalid signature' });
    //   return;
    // }
    
    // Forward data to Zoho Flow
    const zohoResponse = await fetch('https://framer-zoho-relay.vercel.app/api/framer-to-zoho-flow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });
    
    if (!zohoResponse.ok) {
      throw new Error(`Zoho Flow request failed: ${zohoResponse.status}`);
    }
    
    const zohoData = await zohoResponse.json();
    console.log('Zoho Flow response:', zohoData);
    
    // Return success response to Framer
    res.status(200).json({ 
      success: true, 
      message: 'Data successfully sent to Zoho Flow',
      zohoResponse: zohoData 
    });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ 
      error: 'Failed to process webhook', 
      details: error.message 
    });
  }
}

// Optional: Function to verify Framer webhook signature
function verifySignature(payload, signature, submissionId) {
  if (!signature || !submissionId) return false;
  
  const crypto = require('crypto');
  const WEBHOOK_SECRET = process.env.FRAMER_WEBHOOK_SECRET; // Set this in your environment variables
  
  if (!WEBHOOK_SECRET) return true; // Skip verification if no secret is set
  
  if (signature.length !== 71 || !signature.startsWith('sha256=')) {
    return false;
  }
  
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(JSON.stringify(payload));
  hmac.update(submissionId);
  const expectedSignature = 'sha256=' + hmac.digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
