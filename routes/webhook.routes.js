// routes/webhook.routes.js
const express = require('express');
const router = express.Router();
const { getIO } = require('../socket/socketServer');
const knex = require("knex")(require("../knexfile").development);

router.post('/patient-call', async (req, res) => {
  try {
    const { user_id, type, desc } = req.body;

    // Validate required fields
    if (!user_id || !type) {
      return res.status(400).json({ 
        error: 'user_id and type are required' 
      });
    }

    // Validate type (severity)
    const validTypes = ['high', 'medium', 'low'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'type must be one of: high, medium, low' 
      });
    }

    // Create alert in database using knex directly
    const [alertId] = await knex('alerts').insert({
      user_id: user_id,
      desc: desc || `${type} severity alert`, // Default description if not provided
      type: type
    });

    // Get the created alert with timestamp
    const newAlert = await knex('alerts').where('id', alertId).first();

    // Send real-time alert to all connected clients
    const io = getIO();
    io.emit('new_alert', {
      id: newAlert.id,
      user_id: newAlert.user_id,
      desc: newAlert.desc,
      type: newAlert.type,
      created_at: newAlert.created_at
    });

    console.log(`📢 New ${newAlert.type} severity alert from patient ${user_id}: ${newAlert.desc}`);
    
    res.json({ 
      success: true, 
      message: 'Alert received and broadcasted',
      alert: newAlert
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get alerts endpoint
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await knex('alerts')
      .orderBy('created_at', 'desc')
      .limit(50);
    
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;