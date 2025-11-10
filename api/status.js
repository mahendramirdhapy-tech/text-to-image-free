const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobId } = req.query;

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID required' });
    }

    // Check Horde job status
    const statusResponse = await axios.get(`https://aihorde.net/api/v2/generate/check/${jobId}`);
    const statusData = statusResponse.data;

    if (statusData.done) {
      const resultResponse = await axios.get(`https://aihorde.net/api/v2/generate/status/${jobId}`);
      const resultData = resultResponse.data;

      if (resultData.generations && resultData.generations.length > 0) {
        return res.json({
          status: 'completed',
          imageUrl: resultData.generations[0].img
        });
      } else {
        return res.json({
          status: 'failed',
          error: 'No image generated'
        });
      }
    } else {
      return res.json({
        status: 'processing',
        queue_position: statusData.queue_position,
        wait_time: statusData.wait_time
      });
    }
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      status: 'failed', 
      error: error.message 
    });
  }
};
