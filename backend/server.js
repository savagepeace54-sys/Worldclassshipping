const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname,'frontend/index.html'));
});


// ============================
// MongoDB
// ============================

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
// CREATE / SAVE SHIPMENT
// ============================

app.post('/api/shipments', async (req, res) => {

 try {

  const shipment = new Shipment(req.body);

  await shipment.save();

  res.json({
   message: "Shipment saved successfully",
   shipment
  });
app.put('/api/shipments/:trackingNumber', async (req,res)=>{
 try{

  const shipment = await Shipment.findOneAndUpdate(
   { trackingNumber:req.params.trackingNumber },
   req.body,
   { new:true }
  );

  res.json(shipment);

 }catch(err){

  res.status(500).json({error:err.message});

 }
});
app.delete('/api/shipments/:trackingNumber', async (req,res)=>{
 try{

  await Shipment.findOneAndDelete({
   trackingNumber:req.params.trackingNumber
  });

  res.json({message:"Shipment deleted"});

 }catch(err){

  res.status(500).json({error:err.message});

 }
});
 } catch (err) {

  console.error("Error saving shipment:", err);

  res.status(500).json({ error: err.message });

 }

});
// ============================
// Chat Schemas
// ============================

const conversationSchema = new mongoose.Schema({

 trackingNumber:String,

 status:{
  type:String,
  default:"active"
 },

 unreadCount:{
  type:Number,
  default:0
 },

 lastMessage:{
  content:String,
  sender:String,
  createdAt:Date
 },

 createdAt:{
  type:Date,
  default:Date.now
 },

 updatedAt:{
  type:Date,
  default:Date.now
 }

});

const messageSchema = new mongoose.Schema({

 conversationId:{
  type:String,
  required:true
 },

 sender:String,

 content:String,

 read:{
  type:Boolean,
  default:false
 },

 createdAt:{
  type:Date,
  default:Date.now
 }

});

const Conversation = mongoose.model("Conversation",conversationSchema);
const Message = mongoose.model("Message",messageSchema);


// ============================
// Shipment API
// ============================

// get all shipments
app.get('/api/shipments', async(req,res)=>{

 try{

  const shipments = await Shipment.find();

  res.json(shipments);

 }catch(err){

  res.status(500).json({error:err.message});

 }

});


// get shipment
app.get('/api/shipments/:trackingNumber', async(req,res)=>{

 const tn = req.params.trackingNumber;

 try{

  const shipment = await Shipment.findOne({

   trackingNumber:{
    $regex:`^${tn}$`,
    $options:"i"
   }

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


// get conversations
app.get('/api/chat/conversations', async(req,res)=>{

 try{

  const conversations = await Conversation
  .find({status:"active"})
  .sort({updatedAt:-1});

  res.json(conversations);

 }catch(err){

  res.status(500).json({error:err.message});

 }

});


// get or create conversation
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


// ============================
// GET MESSAGES
// ============================

app.get('/api/chat/conversations/:conversationId/messages', async(req,res)=>{

 try{

  const conversationId = req.params.conversationId;

  const messages = await Message.find({
   conversationId:String(conversationId)
  }).sort({createdAt:1});

  res.json(messages);

 }catch(err){

  console.error("Error loading messages:",err);

  res.status(500).json({error:err.message});

 }

});


// ============================
// SEND MESSAGE
// ============================

app.post('/api/chat/conversations/:conversationId/messages', async(req,res)=>{

 try{

  const {content,sender} = req.body;

  const conversationId = String(req.params.conversationId);

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
   update.$inc = {unreadCount:1};
  }

  await Conversation.findByIdAndUpdate(conversationId,update);

  res.json(message);

 }catch(err){

  console.error("Error sending message:",err);

  res.status(500).json({error:err.message});

 }

});


// ============================
// MARK READ
// ============================

app.put('/api/chat/conversations/:conversationId/read', async(req,res)=>{

 try{

  const id = req.params.conversationId;

  await Conversation.findByIdAndUpdate(id,{unreadCount:0});

  await Message.updateMany({

   conversationId:String(id),
   sender:"admin",
   read:false

  },{
   read:true
  });

  res.json({message:"Read updated"});

 }catch(err){

  res.status(500).json({error:err.message});

 }

});


// ============================
// CLOSE CHAT
// ============================

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


// ============================
// DELETE CHAT
// ============================

app.delete('/api/chat/conversations/:conversationId', async(req,res)=>{

 try{

  const id = req.params.conversationId;

  await Conversation.findByIdAndDelete(id);

  await Message.deleteMany({
   conversationId:String(id)
  });

  res.json({message:"Conversation deleted"});

 }catch(err){

  res.status(500).json({error:err.message});

 }

});


// ============================
// START SERVER
// ============================

app.listen(PORT,()=>{

 console.log(`🚀 Server running on port ${PORT}`);

});