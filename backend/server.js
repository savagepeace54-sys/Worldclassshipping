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

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// --------------------
// MongoDB setup
// --------------------
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://nelsoniwinosa54_db_user:CDPHKsGbfYl2UcUH@cluster0.k8apeub.mongodb.net/loginSystem?retryWrites=true&w=majority";

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
  lastUpdate: String,

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
// Chat Schemas
// --------------------

const conversationSchema = new mongoose.Schema({

  trackingNumber: {
    type: String,
    required: true,
    uppercase: true
  },

  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  },

  unreadCount: {
    type: Number,
    default: 0
  },

  lastMessage: {
    content: String,
    sender: String,
    createdAt: Date
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }

});

const messageSchema = new mongoose.Schema({

  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },

  sender: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },

  content: {
    type: String,
    required: true
  },

  read: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

const Conversation = mongoose.model('Conversation', conversationSchema);
const Message = mongoose.model('Message', messageSchema);


// --------------------
// Shipment API
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

  const tn = req.params.trackingNumber;

  try {

    const shipment = await Shipment.findOne({
      trackingNumber: { $regex: `^${tn}$`, $options: "i" }
    });

    if (!shipment) {
      return res.status(404).json({ error: 'Tracking number not found' });
    }

    res.json(shipment);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// CREATE shipment
app.post('/api/shipments', async (req, res) => {

  try {

    const shipment = new Shipment(req.body);

    await shipment.save();

    res.json(shipment);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// UPDATE shipment
app.put('/api/shipments/:trackingNumber', async (req, res) => {

  const tn = req.params.trackingNumber;

  try {

    const shipment = await Shipment.findOneAndUpdate(

      { trackingNumber: { $regex: `^${tn}$`, $options: "i" } },

      req.body,

      { new: true }

    );

    if (!shipment) {
      return res.status(404).json({ error: 'Tracking number not found' });
    }

    res.json(shipment);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// DELETE shipment
app.delete('/api/shipments/:trackingNumber', async (req, res) => {

  const tn = req.params.trackingNumber;

  try {

    await Shipment.findOneAndDelete({
      trackingNumber: { $regex: `^${tn}$`, $options: "i" }
    });

    res.json({ message: 'Shipment deleted' });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// --------------------
// CHAT API
// --------------------


// GET all conversations (admin)
app.get('/api/chat/conversations', async (req, res) => {

  try {

    const conversations = await Conversation.find({ status: 'active' })
      .sort({ updatedAt: -1 });

    res.json(conversations);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// GET or create conversation
app.get('/api/chat/conversations/:trackingNumber', async (req, res) => {

  const tn = req.params.trackingNumber.toUpperCase();

  try {

    let conversation = await Conversation.findOne({
      trackingNumber: tn,
      status: 'active'
    });

    if (!conversation) {

      conversation = new Conversation({
        trackingNumber: tn
      });

      await conversation.save();

    }

    res.json(conversation);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// GET messages (FIXED)
app.get('/api/chat/conversations/:conversationId/messages', async (req, res) => {

  try {

    const conversationId = new mongoose.Types.ObjectId(req.params.conversationId);

    const messages = await Message.find({
      conversationId: conversationId
    }).sort({ createdAt: 1 });

    res.json(messages);

  } catch (err) {

    console.error("Error loading messages:", err);

    res.status(500).json({ error: err.message });

  }

});


// SEND message (FIXED)
app.post('/api/chat/conversations/:conversationId/messages', async (req, res) => {

  try {

    const { content, sender } = req.body;

    const conversationId = new mongoose.Types.ObjectId(req.params.conversationId);

    const message = new Message({

      conversationId,
      sender,
      content

    });

    await message.save();


    const updateData = {

      lastMessage: {
        content,
        sender,
        createdAt: new Date()
      },

      updatedAt: new Date()

    };

    if (sender === "user") {
      updateData.$inc = { unreadCount: 1 };
    }

    await Conversation.findByIdAndUpdate(conversationId, updateData);

    res.json(message);

  } catch (err) {

    console.error("Error sending message:", err);

    res.status(500).json({ error: err.message });

  }

});


// MARK READ
app.put('/api/chat/conversations/:conversationId/read', async (req, res) => {

  try {

    const conversationId = new mongoose.Types.ObjectId(req.params.conversationId);

    await Conversation.findByIdAndUpdate(conversationId, {
      unreadCount: 0
    });

    await Message.updateMany(
      { conversationId: conversationId, sender: 'user', read: false },
      { read: true }
    );

    res.json({ message: 'Marked as read' });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// CLOSE chat
app.put('/api/chat/conversations/:conversationId/close', async (req, res) => {

  try {

    await Conversation.findByIdAndUpdate(req.params.conversationId, {
      status: 'closed'
    });

    res.json({ message: 'Conversation closed' });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// DELETE chat
app.delete('/api/chat/conversations/:conversationId', async (req, res) => {

  try {

    await Conversation.findByIdAndDelete(req.params.conversationId);

    await Message.deleteMany({
      conversationId: req.params.conversationId
    });

    res.json({ message: 'Conversation deleted' });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// --------------------
// Start Server
// --------------------

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});