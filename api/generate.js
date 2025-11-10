const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, style, size, api } = req.body;
    const [width, height] = size.split('x').map(Number);
    const fullPrompt = `${prompt}, ${style} style`;

    let result;

    switch (api) {
      case 'horde':
        result = await generateWithHorde(fullPrompt, width, height);
        break;
      case 'clipdrop':
        result = await generateWithClipDrop(fullPrompt, width, height);
        break;
      case 'stability':
        result = await generateWithStability(fullPrompt, width, height);
        break;
      default:
        throw new Error('Invalid API selected');
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// AI Horde Implementation
async function generateWithHorde(prompt, width, height) {
  const response = await axios.post('https://aihorde.net/api/v2/generate/async', {
    prompt: prompt,
    params: {
      width: width,
      height: height,
      steps: 20,
      n: 1
    },
    models: ['Stable Diffusion'],
  });

  return {
    success: true,
    jobId: response.data.id,
    api: 'horde'
  };
}

// ClipDrop Implementation
async function generateWithClipDrop(prompt, width, height) {
  // Use environment variable for API key
  const apiKey = process.env.CLIPDROP_API_KEY;
  
  if (!apiKey) {
    throw new Error('ClipDrop API key not configured');
  }

  const formData = new FormData();
  formData.append('prompt', prompt);

  const response = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
    headers: {
      'x-api-key': apiKey,
    },
    responseType: 'arraybuffer'
  });

  // Convert to base64 for response
  const base64Image = Buffer.from(response.data).toString('base64');
  const imageUrl = `data:image/png;base64,${base64Image}`;

  return {
    success: true,
    imageUrl: imageUrl,
    api: 'clipdrop'
  };
}

// Stability AI Implementation
async function generateWithStability(prompt, width, height) {
  const apiKey = process.env.STABILITY_AI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Stability AI API key not configured');
  }

  const response = await axios.post(
    'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
    {
      text_prompts: [{ text: prompt }],
      cfg_scale: 7,
      height: height,
      width: width,
      steps: 30,
      samples: 1,
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    }
  );

  const base64Image = response.data.artifacts[0].base64;
  const imageUrl = `data:image/png;base64,${base64Image}`;

  return {
    success: true,
    imageUrl: imageUrl,
    api: 'stability'
  };
}
