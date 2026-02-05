const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------
// Middleware
// --------------------
app.use(express.json());

// Serve static frontend files (make sure folder is frontend/)
app.use(express.static(path.join(__dirname, '../frontend')));

// Default route → index.html (lowercase!)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --------------------
// MongoDB setup
// --------------------
const MONGODB_URI = "mongodb+srv://nelsoniwinosa54_db_user:CDPHKsGbfYl2UcUH@cluster0.k8apeub.mongodb.net/loginSystem?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection failed:', err));

// --------------------
// Shipment Schema
// --------------------
const shipmentSchema = new mongoose.Schema({
  trackingNumber: { type: String, required: true, uppercase: true },
  sender: String,
  recipient: String,
  origin: String,
  destination: String,
  weight: String,
  status: String,
  progress: [String],
  history: [
    {
      date: String,
      location: String,
      status: String
    }
  ],
  route: [
    {
      lat: Number,
      lng: Number,
      label: String
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

const Shipment = mongoose.model('Shipment', shipmentSchema);

// --------------------
// API Routes
// --------------------

// GET all shipments
app.get('/api/shipments', async (req, res) => {
  try {
    const shipments = await Shipment.find();
    res.json(shipments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET shipment by tracking number
app.get('/api/shipments/:trackingNumber', async (req, res) => {
  const trackingNumber = req.params.trackingNumber.toUpperCase();
  try {
    const shipment = await Shipment.findOne({ trackingNumber });
    if (!shipment) return res.status(404).json({ error: 'Tracking number not found' });
    res.json(shipment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new shipment
app.post('/api/shipments', async (req, res) => {
  try {
    const shipment = new Shipment(req.body);
    await shipment.save();
    res.json(shipment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (update) shipment
app.put('/api/shipments/:trackingNumber', async (req, res) => {
  const trackingNumber = req.params.trackingNumber.toUpperCase();
  try {
    const shipment = await Shipment.findOneAndUpdate(
      { trackingNumber },
      req.body,
      { new: true, runValidators: true }
    );
    if (!shipment) return res.status(404).json({ error: 'Tracking number not found' });
    res.json(shipment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE shipment
app.delete('/api/shipments/:trackingNumber', async (req, res) => {
  const trackingNumber = req.params.trackingNumber.toUpperCase();
  try {
    const shipment = await Shipment.findOneAndDelete({ trackingNumber });
    if (!shipment) return res.status(404).json({ error: 'Tracking number not found' });
    res.json({ message: 'Shipment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// Start server
// --------------------
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
