const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------
// Middleware
// --------------------
app.use(express.json());

// --------------------
// Serve static frontend files
// --------------------
app.use(express.static(path.join(__dirname, 'frontend')));

// Default route → lowercase index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
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
  lastUpdate: String, // <-- added field
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
// Chat Schema
// --------------------
const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Conversation' },
  sender: { type: String, required: true, enum: ['user', 'admin'] },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const conversationSchema = new mongoose.Schema({
  trackingNumber: { type: String, required: true },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  unreadCount: { type: Number, default: 0 },
  lastMessage: {
    content: String,
    sender: String,
    createdAt: Date
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);

// --------------------
// API Routes - Shipments
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

// GET shipment by tracking number (case-insensitive)
app.get('/api/shipments/:trackingNumber', async (req, res) => {
  const tn = req.params.trackingNumber;
  try {
    const shipment = await Shipment.findOne({
      trackingNumber: { $regex: `^${tn}$`, $options: "i" } // case-insensitive match
    });
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
  const tn = req.params.trackingNumber;
  try {
    const shipment = await Shipment.findOneAndUpdate(
      { trackingNumber: { $regex: `^${tn}$`, $options: "i" } }, // case-insensitive
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
  const tn = req.params.trackingNumber;
  try {
    const shipment = await Shipment.findOneAndDelete({
      trackingNumber: { $regex: `^${tn}$`, $options: "i" } // case-insensitive
    });
    if (!shipment) return res.status(404).json({ error: 'Tracking number not found' });
    res.json({ message: 'Shipment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// API Routes - Chat
// --------------------

// GET all conversations
app.get('/api/chat/conversations', async (req, res) => {
  try {
    console.log('Fetching all conversations...'); // Debug log
    const conversations = await Conversation.find({ status: 'active' })
      .sort({ updatedAt: -1 });
    console.log(`Found ${conversations.length} conversations:`, conversations.map(c => ({ id: c._id, tn: c.trackingNumber, status: c.status }))); // Debug log
    res.json(conversations);
  } catch (err) {
    console.error('Error fetching conversations:', err); // Debug log
    res.status(500).json({ error: err.message });
  }
});

// GET or create conversation by tracking number
app.get('/api/chat/conversations/:trackingNumber', async (req, res) => {
  const tn = req.params.trackingNumber.toUpperCase();
  console.log(`Getting/creating conversation for tracking number: ${tn}`); // Debug log
  try {
    let conversation = await Conversation.findOne({ 
      trackingNumber: tn,
      status: 'active'
    });
    
    if (!conversation) {
      console.log(`Creating new conversation for ${tn}`); // Debug log
      conversation = new Conversation({ trackingNumber: tn });
      await conversation.save();
      console.log(`Conversation created: ${conversation._id}`); // Debug log
    } else {
      console.log(`Found existing conversation: ${conversation._id}`); // Debug log
    }
    
    res.json(conversation);
  } catch (err) {
    console.error('Error getting/creating conversation:', err); // Debug log
    res.status(500).json({ error: err.message });
  }
});

// GET messages for a conversation
app.get('/api/chat/conversations/:conversationId/messages', async (req, res) => {
  try {
    console.log(`Fetching messages for conversation: ${req.params.conversationId}`); // Debug log
    const messages = await Message.find({ 
      conversationId: req.params.conversationId 
    }).sort({ createdAt: 1 });
    console.log(`Found ${messages.length} messages`); // Debug log
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err); // Debug log
    res.status(500).json({ error: err.message });
  }
});

// POST a new message
app.post('/api/chat/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { content, sender } = req.body;
    const conversationId = req.params.conversationId;
    
    console.log(`Received message from ${sender} in conversation ${conversationId}:`, content); // Debug log
    
    // Create message
    const message = new Message({
      conversationId,
      sender,
      content
    });
    await message.save();
    console.log('Message saved:', message._id); // Debug log
    
    // Update conversation
    const updateData = {
      lastMessage: {
        content,
        sender,
        createdAt: new Date()
      },
      updatedAt: new Date()
    };
    
    // Increment unread count if message is from user
    if (sender === 'user') {
      updateData.$inc = { unreadCount: 1 };
    }
    
    await Conversation.findByIdAndUpdate(conversationId, updateData);
    console.log('Conversation updated'); // Debug log
    
    res.json(message);
  } catch (err) {
    console.error('Error saving message:', err); // Debug log
    res.status(500).json({ error: err.message });
  }
});

// Mark conversation as read
app.put('/api/chat/conversations/:conversationId/read', async (req, res) => {
  try {
    await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      { unreadCount: 0 }
    );
    
    // Mark all messages as read
    await Message.updateMany(
      { 
        conversationId: req.params.conversationId,
        sender: 'user',
        read: false
      },
      { read: true }
    );
    
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close conversation
app.put('/api/chat/conversations/:conversationId/close', async (req, res) => {
  try {
    await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      { status: 'closed' }
    );
    res.json({ message: 'Conversation closed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete conversation
app.delete('/api/chat/conversations/:conversationId', async (req, res) => {
  try {
    await Conversation.findByIdAndDelete(req.params.conversationId);
    await Message.deleteMany({ conversationId: req.params.conversationId });
    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// Start server
// --------------------
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
