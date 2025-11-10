const axios = require('axios');
const FormData = require('form-data');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { prompt, style, size, api } = req.body;
    
    // Validate input
    if (!prompt || !style || !size || !api) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: prompt, style, size, api'
      });
    }

    const [width, height] = size.split('x').map(Number);
    const fullPrompt = `${prompt}, ${style} style`;

    console.log(`Generating image with ${api}: ${fullPrompt}`);

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
        throw new Error(`Invalid API selected: ${api}`);
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

// AI Horde Implementation with API Key
async function generateWithHorde(prompt, width, height) {
  const apiKey = process.env.AI_HORDE_API_KEY;
  
  if (!apiKey) {
    throw new Error('AI Horde API key not configured. Please add AI_HORDE_API_KEY to environment variables.');
  }

  const payload = {
    prompt: prompt,
    params: {
      width: width,
      height: height,
      steps: 30,
      n: 1,
      sampler_name: 'k_euler_a',
      cfg_scale: 7.5,
      clip_skip: 1,
      karras: true,
      hires_fix: false,
      post_processing: ['GFPGAN', 'CodeFormers']
    },
    models: ['SDXL_beta::stability.ai@02bd079c'],
    nsfw: false,
    trusted_workers: true,
    censor_nsfw: false,
    slow_workers: false,
    workers: [],
    worker_blacklist: false,
    dry_run: false
  };

  console.log('Sending request to AI Horde with API key');

  const response = await axios.post('https://aihorde.net/api/v2/generate/async', payload, {
    headers: {
      'apikey': apiKey,
      'Client-Agent': 'text-to-image-app/1.0',
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  if (!response.data.id) {
    throw new Error('AI Horde: Failed to create generation job - ' + JSON.stringify(response.data));
  }

  console.log('AI Horde job created:', response.data.id);

  return {
    success: true,
    jobId: response.data.id,
    api: 'horde'
  };
}

// ClipDrop Implementation  
async function generateWithClipDrop(prompt, width, height) {
  const apiKey = process.env.CLIPDROP_API_KEY;
  
  if (!apiKey) {
    throw new Error('ClipDrop API key not configured. Please add CLIPDROP_API_KEY to environment variables.');
  }

  const formData = new FormData();
  formData.append('prompt', prompt);

  const response = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
    headers: {
      'x-api-key': apiKey,
      ...formData.getHeaders()
    },
    responseType: 'arraybuffer',
    timeout: 30000
  });

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
    throw new Error('Stability AI API key not configured. Please add STABILITY_AI_API_KEY to environment variables.');
  }

  const response = await axios.post(
    'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
    {
      text_prompts: [
        {
          text: prompt,
          weight: 1
        }
      ],
      cfg_scale: 7,
      height: Math.min(height, 1024),
      width: Math.min(width, 1024),
      steps: 30,
      samples: 1,
      style_preset: 'enhance',
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    }
  );

  if (!response.data.artifacts || response.data.artifacts.length === 0) {
    throw new Error('Stability AI: No image generated');
  }

  const base64Image = response.data.artifacts[0].base64;
  const imageUrl = `data:image/png;base64,${base64Image}`;

  return {
    success: true,
    imageUrl: imageUrl,
    api: 'stability'
  };
}
