const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// MongoDB
const MONGODB_URI = "mongodb+srv://nelsoniwinosa54_db_user:CDPHKsGbfYl2UcUH@cluster0.k8apeub.mongodb.net/loginSystem?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI)
.then(()=>console.log("✅ MongoDB connected"))
.catch(err=>console.error("Mongo error:",err));


// ============================
// Shipment Schema
// ============================

const shipmentSchema = new mongoose.Schema({
  trackingNumber:{type:String,required:true,uppercase:true},
  sender:String,
  recipient:String,
  origin:String,
  destination:String,
  weight:String,
  status:String,
  lastUpdate:String,
  route:[
    {
      lat:Number,
      lng:Number,
      label:String
    }
  ],
  createdAt:{type:Date,default:Date.now}
});

const Shipment = mongoose.model("Shipment",shipmentSchema);


// ============================
// Chat Schemas
// ============================

const conversationSchema = new mongoose.Schema({
  trackingNumber:String,
  status:{type:String,default:"active"},
  unreadCount:{type:Number,default:0},
  lastMessage:{
    content:String,
    sender:String,
    createdAt:Date
  },
  createdAt:{type:Date,default:Date.now},
  updatedAt:{type:Date,default:Date.now}
});

const messageSchema = new mongoose.Schema({
  conversationId:String,
  sender:String,
  content:String,
  read:{type:Boolean,default:false},
  createdAt:{type:Date,default:Date.now}
});

const Conversation = mongoose.model("Conversation",conversationSchema);
const Message = mongoose.model("Message",messageSchema);


// ============================
// Shipment API
// ============================

// Get all shipments
app.get('/api/shipments', async(req,res)=>{
  try{
    const shipments = await Shipment.find();
    res.json(shipments);
  }catch(err){
    res.status(500).json({error:err.message});
  }
});

// Get shipment
app.get('/api/shipments/:trackingNumber', async(req,res)=>{

  const tn = req.params.trackingNumber;

  try{

    const shipment = await Shipment.findOne({
      trackingNumber:{ $regex:`^${tn}$`, $options:"i" }
    });

    if(!shipment){
      return res.status(404).json({error:"Shipment not found"});
    }

    res.json(shipment);

  }catch(err){
    res.status(500).json({error:err.message});
  }

});


// ============================
// Chat API
// ============================


// Get all conversations
app.get('/api/chat/conversations', async(req,res)=>{

  try{

    const conversations = await Conversation.find({
      status:"active"
    }).sort({updatedAt:-1});

    res.json(conversations);

  }catch(err){
    res.status(500).json({error:err.message});
  }

});


// Get or create conversation
app.get('/api/chat/conversations/:trackingNumber', async(req,res)=>{

  const tn = req.params.trackingNumber.toUpperCase();

  try{

    let conversation = await Conversation.findOne({
      trackingNumber:tn,
      status:"active"
    });

    if(!conversation){

      conversation = new Conversation({
        trackingNumber:tn
      });

      await conversation.save();

    }

    res.json(conversation);

  }catch(err){
    res.status(500).json({error:err.message});
  }

});


// Get messages
app.get('/api/chat/conversations/:conversationId/messages', async(req,res)=>{

  try{

    const messages = await Message.find({
      conversationId:req.params.conversationId
    }).sort({createdAt:1});

    res.json(messages);

  }catch(err){

    console.error("Error loading messages:",err);
    res.status(500).json({error:err.message});

  }

});


// Send message
app.post('/api/chat/conversations/:conversationId/messages', async(req,res)=>{

  try{

    const {content,sender} = req.body;
    const conversationId = req.params.conversationId;

    const message = new Message({
      conversationId,
      sender,
      content
    });

    await message.save();

    const update = {
      lastMessage:{
        content,
        sender,
        createdAt:new Date()
      },
      updatedAt:new Date()
    };

    if(sender==="user"){
      update.$inc={unreadCount:1};
    }

    await Conversation.findByIdAndUpdate(conversationId,update);

    res.json(message);

  }catch(err){

    console.error("Error sending message:",err);
    res.status(500).json({error:err.message});

  }

});


// Mark as read
app.put('/api/chat/conversations/:conversationId/read', async(req,res)=>{

  try{

    await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      {unreadCount:0}
    );

    await Message.updateMany(
      {
        conversationId:req.params.conversationId,
        sender:"admin",
        read:false
      },
      {read:true}
    );

    res.json({message:"Read updated"});

  }catch(err){
    res.status(500).json({error:err.message});
  }

});


// Close chat
app.put('/api/chat/conversations/:conversationId/close', async(req,res)=>{

  try{

    await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      {status:"closed"}
    );

    res.json({message:"Conversation closed"});

  }catch(err){
    res.status(500).json({error:err.message});
  }

});


// Delete chat
app.delete('/api/chat/conversations/:conversationId', async(req,res)=>{

  try{

    await Conversation.findByIdAndDelete(req.params.conversationId);

    await Message.deleteMany({
      conversationId:req.params.conversationId
    });

    res.json({message:"Conversation deleted"});

  }catch(err){
    res.status(500).json({error:err.message});
  }

});


// Start server
app.listen(PORT,()=>{

  console.log(`🚀 Server running on port ${PORT}`);

});