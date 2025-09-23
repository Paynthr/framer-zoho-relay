// api/framer-to-zoho-flow.js
export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  let formData;
  
  // Handle both GET (query params) and POST (JSON body) requests
  if (req.method === 'GET') {
    formData = req.query;
  } else if (req.method === 'POST') {
    formData = req.body;
  } else {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    console.log('Received form data:', formData);
    
    // Format data for GoHighLevel via Zoho Flow
    const ghlFormattedData = {
      email: formData.email || formData.Email || formData.emailAddress,
      phone: formData.phone || formData.Phone || formData.phoneNumber || '+0000000000',
      firstName: formData.firstName || formData.first_name || formData.name?.split(' ')[0] || formData.name,
      lastName: formData.lastName || formData.last_name || formData.name?.split(' ').slice(1).join(' ') || '',
      tags: formData.tags || ['Framer Form', 'Website Lead'],
      source: formData.source || 'Framer Website Form',
      ...formData
    };
    
    // Remove undefined values
    Object.keys(ghlFormattedData).forEach(key => {
      if (ghlFormattedData[key] === undefined || ghlFormattedData[key] === null) {
        delete ghlFormattedData[key];
      }
    });
    
    console.log('Formatted data:', ghlFormattedData);
    
    // Send to GoHighLevel via Zoho Flow
    const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/CPIf6z9YtYauZ0vxcT2t/webhook-trigger/20bc36ad-1a8f-4a9d-a445-6f77998a8bec';
    
    const ghlResponse = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ghlFormattedData)
    });
    
    let ghlData;
    try {
      const responseText = await ghlResponse.text();
      console.log('GHL response:', responseText);
      ghlData = responseText;
    } catch (readError) {
      console.error('Error reading GHL response:', readError);
      ghlData = { error: 'Could not read response' };
    }
    
    if (!ghlResponse.ok) {
      console.error('GHL request failed:', ghlResponse.status);
    }
    
    // For GET requests (image loading), return a 1x1 pixel image
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'image/gif');
      // 1x1 transparent pixel
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.status(200).send(pixel);
    } else {
      // For POST requests, return JSON
      res.status(200).json({ 
        success: true, 
        message: 'Data successfully sent to GoHighLevel',
        ghlResponse: ghlData 
      });
    }
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    if (req.method === 'GET') {
      // Return error pixel for GET requests
      res.setHeader('Content-Type', 'image/gif');
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.status(200).send(pixel);
    } else {
      res.status(500).json({ 
        error: 'Failed to process webhook', 
        details: error.message 
      });
    }
  }
}
