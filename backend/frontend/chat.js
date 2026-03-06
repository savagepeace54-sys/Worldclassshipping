// ===== ADMIN CHAT SYSTEM =====

const API_BASE = '/api/chat';

let currentChatId = null;
let currentTrackingNumber = null;
let chats = [];
let refreshInterval = null;

// DOM Elements
const chatList = document.getElementById('chatList');
const chatMessages = document.getElementById('chatMessages');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const chatInputArea = document.getElementById('chatInputArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const searchInput = document.getElementById('searchChats');
const closeChatBtn = document.getElementById('closeChatBtn');
const deleteChatBtn = document.getElementById('deleteChatBtn');
const totalUnreadBadge = document.getElementById('totalUnread');
const toast = document.getElementById('toast');

// INIT
document.addEventListener('DOMContentLoaded', () => {
  loadChats();
  setupEventListeners();
  startAutoRefresh();
});

// EVENT LISTENERS
function setupEventListeners() {

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);

  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    messageInput.addEventListener('input', autoResize);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterChats(e.target.value);
    });
  }

  if (closeChatBtn) closeChatBtn.addEventListener('click', closeCurrentChat);
  if (deleteChatBtn) deleteChatBtn.addEventListener('click', deleteCurrentChat);
}

// LOAD CHATS
async function loadChats() {
  try {

    const res = await fetch(`${API_BASE}/conversations`);
    chats = await res.json();

    renderChatList();
    updateTotalUnread();

  } catch (err) {

    console.error(err);
    showToast('Failed to load chats', 'error');

  }
}

// RENDER CHAT LIST
function renderChatList() {

  if (!chats.length) {
    chatList.innerHTML = `<div class="empty-state"><p>No active chats</p></div>`;
    return;
  }

  chatList.innerHTML = chats.map(chat => {

    let lastMessage = chat.lastMessage || {};

    if (typeof lastMessage === "string") {
      try {
        lastMessage = JSON.parse(lastMessage);
      } catch {
        lastMessage = {};
      }
    }

    const unreadCount = chat.unreadCount || 0;
    const preview = lastMessage.content || "No messages yet";
    const time = lastMessage.createdAt ? formatTime(lastMessage.createdAt) : "";

    return `
    <div class="chat-item ${chat._id === currentChatId ? 'active' : ''}"
      onclick="selectChat('${chat._id}')">

      <div class="chat-avatar">
        ${chat.trackingNumber ? chat.trackingNumber.slice(0,2) : "??"}
      </div>

      <div class="chat-info">
        <div class="chat-name">${chat.trackingNumber || "Unknown"}</div>
        <div class="chat-preview">${preview}</div>
      </div>

      <div class="chat-meta">
        <div class="chat-time">${time}</div>
        ${unreadCount ? `<span class="chat-unread">${unreadCount}</span>` : ''}
      </div>

    </div>
    `;

  }).join("");
}

// SELECT CHAT
window.selectChat = async function(chatId){

  currentChatId = chatId;

  const chat = chats.find(c => c._id === chatId);
  if(!chat) return;

  currentTrackingNumber = chat.trackingNumber;

  chatTitle.textContent = `Tracking: ${chat.trackingNumber}`;
  chatSubtitle.textContent = `Started: ${formatDate(chat.createdAt)}`;

  chatInputArea.style.display = "block";

  await loadMessages(chatId);
  await markAsRead(chatId);

}

// LOAD MESSAGES
async function loadMessages(chatId){

  try{

    const res = await fetch(`${API_BASE}/conversations/${chatId}/messages`);
    const messages = await res.json();

    renderMessages(messages);

  }catch(err){

    console.error(err);
    showToast("Failed to load messages","error");

  }

}

// RENDER MESSAGES
function renderMessages(messages){

  if(!messages.length){

    chatMessages.innerHTML = `
    <div class="empty-chat">
      <div class="empty-icon">💬</div>
      <p>No messages yet</p>
    </div>`;

    return;

  }

  chatMessages.innerHTML = messages.map(msg=>{

    const isAdmin = msg.sender === "admin";

    return `
    <div class="message ${isAdmin ? "sent":"received"}">

      <div class="message-header">
        ${isAdmin ? "You (Admin)":"Customer"}
      </div>

      <div class="message-content">
        ${escapeHtml(msg.content)}
      </div>

      <div class="message-time">
        ${formatTime(msg.createdAt)}
      </div>

    </div>
    `

  }).join("");

  scrollToBottom();

}

// SEND MESSAGE
async function sendMessage(){

  const content = messageInput.value.trim();
  if(!content || !currentChatId) return;

  try{

    await fetch(`${API_BASE}/conversations/${currentChatId}/messages`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        content,
        sender:"admin"
      })
    });

    messageInput.value="";
    messageInput.style.height="auto";

    await loadMessages(currentChatId);
    await loadChats();

  }catch(err){

    console.error(err);
    showToast("Failed to send message","error");

  }

}

// MARK READ
async function markAsRead(chatId){

  try{
    await fetch(`${API_BASE}/conversations/${chatId}/read`,{method:"PUT"});
  }catch(err){
    console.error(err);
  }

}

// RESET VIEW
function resetChatView(){

  currentChatId = null;

  chatTitle.textContent = "Select a chat";
  chatSubtitle.textContent = "Click on a conversation";

  chatInputArea.style.display = "none";

  chatMessages.innerHTML = `
  <div class="empty-chat">
    <div class="empty-icon">💬</div>
    <p>Select a conversation</p>
  </div>`;
}

// FILTER CHATS
function filterChats(query){

  const items=document.querySelectorAll(".chat-item");

  items.forEach(item=>{

    const name=item.querySelector(".chat-name").textContent.toLowerCase();
    item.style.display = name.includes(query.toLowerCase()) ? "flex":"none";

  });

}

// UNREAD COUNT
function updateTotalUnread(){

  const total = chats.reduce((sum,c)=>sum+(c.unreadCount||0),0);

  totalUnreadBadge.textContent=total;
  totalUnreadBadge.style.display = total ? "inline-block":"none";

}

// AUTO RESIZE
function autoResize(){
  this.style.height="auto";
  this.style.height=Math.min(this.scrollHeight,120)+"px";
}

// SCROLL
function scrollToBottom(){
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// FORMAT TIME
function formatTime(date){
  const d=new Date(date);
  return d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
}

// FORMAT DATE
function formatDate(date){
  const d=new Date(date);
  return d.toLocaleString();
}

// ESCAPE HTML
function escapeHtml(text){
  const div=document.createElement("div");
  div.textContent=text;
  return div.innerHTML;
}

// TOAST
function showToast(msg,type="info"){
  toast.textContent=msg;
  toast.className=`toast ${type} show`;

  setTimeout(()=>{
    toast.classList.remove("show");
  },3000);
}

// AUTO REFRESH
function startAutoRefresh(){

  refreshInterval=setInterval(()=>{

    loadChats();

    if(currentChatId){
      loadMessages(currentChatId);
    }

  },4000);

}