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
    
    // Format data for GoHighLevel via Zoho Flow
    // GHL typically expects specific field names and structure
    const ghlFormattedData = {
      // Map form fields to GHL expected fields
      email: formData.email || formData.Email || formData.emailAddress,
      phone: formData.phone || formData.Phone || formData.phoneNumber,
      firstName: formData.firstName || formData.first_name || formData.name?.split(' ')[0] || formData.name,
      lastName: formData.lastName || formData.last_name || formData.name?.split(' ').slice(1).join(' ') || '',
      // Include any additional fields
      ...formData
    };
    
    // Remove undefined values
    Object.keys(ghlFormattedData).forEach(key => {
      if (ghlFormattedData[key] === undefined || ghlFormattedData[key] === null) {
        delete ghlFormattedData[key];
      }
    });
    
    console.log('Original form data:', formData);
    console.log('GHL formatted data:', ghlFormattedData);
    
    // Send directly to GoHighLevel webhook (bypassing Zoho Flow)
    const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/CPIf6z9YtYauZ0vxcT2t/webhook-trigger/20bc36ad-1a8f-4a9d-a445-6f77998a8bec';
    
    console.log('Sending directly to GoHighLevel:', GHL_WEBHOOK_URL);
    console.log('Payload:', JSON.stringify(ghlFormattedData, null, 2));
    
    const ghlResponse = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ghlFormattedData)
    });
    
    console.log('GHL response status:', ghlResponse.status);
    
    let ghlData;
    try {
      const responseText = await ghlResponse.text();
      console.log('GHL raw response:', responseText);
      
      try {
        ghlData = JSON.parse(responseText);
      } catch (parseError) {
        ghlData = { rawResponse: responseText };
      }
    } catch (readError) {
      console.error('Error reading GHL response:', readError);
      ghlData = { error: 'Could not read response' };
    }
    
    if (!ghlResponse.ok) {
      console.error('GHL request failed:', {
        status: ghlResponse.status,
        statusText: ghlResponse.statusText,
        response: ghlData
      });
      
      // Still return success to Framer, but log the GHL error
      res.status(200).json({ 
        success: true, 
        message: 'Data received but GHL encountered an issue',
        ghlStatus: ghlResponse.status,
        ghlError: ghlData
      });
      return;
    }
    
    console.log('GHL response:', ghlData);
    
    // Return success response to Framer
    res.status(200).json({ 
      success: true, 
      message: 'Data successfully sent to GoHighLevel',
      ghlResponse: ghlData 
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
