// ===============================
// GET TRACKING NUMBER
// ===============================
const params = new URLSearchParams(window.location.search);
const tn = params.get("tn")?.trim().toUpperCase();

if (!tn) {
  document.body.innerHTML = "<h2>No tracking number provided</h2>";
  throw new Error("Tracking number missing");
}

// ===============================
// CHAT VARIABLES
// ===============================
let conversationId = null;
let chatRefreshInterval = null;

// DOM
const chatFab = document.getElementById("chatFab");
const chatWindow = document.getElementById("chatWindow");
const chatCloseBtn = document.getElementById("chatCloseBtn");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatMessages = document.getElementById("chatMessages");
const chatBody = document.getElementById("chatBody");
const chatBadge = document.getElementById("chatBadge");
const chatTrackingNumber = document.getElementById("chatTrackingNumber");

// ===============================
// LOAD SHIPMENT
// ===============================
fetch(`/api/shipments/${tn}`)
  .then(res => {
    if (!res.ok) throw new Error("Shipment not found");
    return res.json();
  })
  .then(shipment => {

    document.getElementById("tn").textContent = shipment.trackingNumber || "N/A";
    document.getElementById("sender").textContent = shipment.sender || "N/A";
    document.getElementById("receiver").textContent = shipment.recipient || "N/A";
    document.getElementById("origin").textContent = shipment.origin || "N/A";
    document.getElementById("destination").textContent = shipment.destination || "N/A";
    document.getElementById("weight").textContent = shipment.weight || "N/A";
    document.getElementById("status").textContent = shipment.status || "N/A";
    document.getElementById("lastUpdate").textContent = shipment.lastUpdate || "N/A";

    initMap(shipment);

    initializeChat();

  })
  .catch(err => {
    document.body.innerHTML = "<h2>Shipment not found</h2>";
    console.error(err);
  });


// ===============================
// MAP
// ===============================
function initMap(shipment){

  const map = L.map("map").setView([6.5244,3.3792],4);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  if(!shipment.route) return;

  shipment.route.forEach(r=>{
    L.marker([r.lat,r.lng]).addTo(map).bindPopup(r.label || "");
  });

  const coords = shipment.route.map(r=>[r.lat,r.lng]);

  if(coords.length){
    map.fitBounds(coords);
  }

}


// ===============================
// CHAT INITIALIZE
// ===============================
function initializeChat(){

  chatTrackingNumber.textContent = tn;

  chatFab.addEventListener("click", toggleChat);
  chatCloseBtn.addEventListener("click", closeChat);
  chatSendBtn.addEventListener("click", sendMessage);

  chatInput.addEventListener("keydown", e=>{
    if(e.key==="Enter"){
      sendMessage();
    }
  });

  getConversation();

}


// ===============================
// GET / CREATE CONVERSATION
// ===============================
async function getConversation(){

  try{

    const res = await fetch(`/api/chat/conversations/${tn}`);

    const conversation = await res.json();

    if(!conversation || !conversation._id){
      console.error("Conversation invalid");
      return;
    }

    conversationId = conversation._id;

    console.log("Conversation ID:",conversationId);

    loadMessages();

    startAutoRefresh();

  }catch(err){

    console.error("Conversation error:",err);

  }

}


// ===============================
// LOAD MESSAGES
// ===============================
async function loadMessages(){

  if(!conversationId) return;

  try{

    const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);

    const messages = await res.json();

    renderMessages(messages);

    updateUnread(messages);

  }catch(err){

    console.error("Load messages error:",err);

  }

}


// ===============================
// RENDER MESSAGES
// ===============================
function renderMessages(messages){

  if(!messages.length){
    chatMessages.innerHTML = "";
    return;
  }

  chatMessages.innerHTML = messages.map(msg=>{

    const isUser = msg.sender === "user";

    return `
    <div class="message ${isUser ? "user":"admin"}">

        <div class="message-content">
        ${escapeHtml(msg.content)}
        </div>

        <div class="message-time">
        ${formatTime(msg.createdAt)}
        </div>

    </div>
    `;

  }).join("");

  scrollBottom();

}


// ===============================
// SEND MESSAGE
// ===============================
async function sendMessage(){

  const content = chatInput.value.trim();

  if(!content || !conversationId) return;

  chatInput.value = "";

  try{

    await fetch(`/api/chat/conversations/${conversationId}/messages`,{

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({
        content,
        sender:"user"
      })

    });

    loadMessages();

  }catch(err){

    console.error("Send error:",err);

  }

}


// ===============================
// OPEN / CLOSE CHAT
// ===============================
function toggleChat(){

  if(chatWindow.classList.contains("open")){
    closeChat();
  }else{
    openChat();
  }

}

function openChat(){

  chatWindow.classList.add("open");

  setTimeout(()=>{
    chatInput.focus();
  },200);

}

function closeChat(){

  chatWindow.classList.remove("open");

}


// ===============================
// UNREAD COUNT
// ===============================
function updateUnread(messages){

  const unread = messages.filter(m=>m.sender==="admin" && !m.read);

  if(unread.length){

    chatBadge.textContent = unread.length;

    chatBadge.classList.add("show");

  }else{

    chatBadge.classList.remove("show");

  }

}


// ===============================
// AUTO REFRESH
// ===============================
function startAutoRefresh(){

  chatRefreshInterval = setInterval(()=>{

    if(conversationId){
      loadMessages();
    }

  },4000);

}


// ===============================
// HELPERS
// ===============================
function scrollBottom(){
  chatBody.scrollTop = chatBody.scrollHeight;
}

function formatTime(date){
  const d = new Date(date);
  return d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
}

function escapeHtml(text){
  const div=document.createElement("div");
  div.textContent=text;
  return div.innerHTML;
}