// Get tracking number from URL
const params = new URLSearchParams(window.location.search);
const tn = params.get("tn")?.trim().toUpperCase(); // <-- trim + uppercase

if (!tn) {
  document.body.innerHTML = "<h2>No tracking number provided</h2>";
  throw new Error("No tracking number in URL");
}

// Chat variables
let conversationId = null;
let chatRefreshInterval = null;

// DOM Elements
const chatFab = document.getElementById('chatFab');
const chatWindow = document.getElementById('chatWindow');
const chatCloseBtn = document.getElementById('chatCloseBtn');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatMessages = document.getElementById('chatMessages');
const chatBody = document.getElementById('chatBody');
const chatBadge = document.getElementById('chatBadge');
const chatTrackingNumber = document.getElementById('chatTrackingNumber');
const typingIndicator = document.getElementById('typingIndicator');

// Fetch shipment from backend
fetch(`/api/shipments/${tn}`)
  .then(res => {
    if (!res.ok) throw new Error("Shipment not found");
    return res.json();
  })
  .then(shipment => {
    const tnElem = document.getElementById("tn");
    const senderElem = document.getElementById("sender");
    const receiverElem = document.getElementById("receiver");
    const originElem = document.getElementById("origin");
    const destinationElem = document.getElementById("destination");
    const weightElem = document.getElementById("weight");
    const statusElem = document.getElementById("status");
    const lastUpdateElem = document.getElementById("lastUpdate");

    // Fill shipment info
    tnElem.textContent = shipment.trackingNumber || "N/A";
    senderElem.textContent = shipment.sender || "N/A";
    receiverElem.textContent = shipment.recipient || "N/A";
    originElem.textContent = shipment.origin || "N/A";
    destinationElem.textContent = shipment.destination || "N/A";
    weightElem.textContent = shipment.weight || "N/A";
    statusElem.textContent = shipment.status || "N/A";
    lastUpdateElem.textContent = shipment.lastUpdate || "N/A";

    // Map
    const map = L.map("map").setView([6.5244, 3.3792], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    shipment.route?.forEach(r => {
      L.marker([r.lat, r.lng]).addTo(map).bindPopup(r.label || "");
    });
    const coords = shipment.route?.map(r => [r.lat, r.lng]) || [];
    if (coords.length) map.fitBounds(coords);

    // Initialize chat after shipment is loaded
    initializeChat();

  })
  .catch(err => {
    document.body.innerHTML = "<h2>Shipment not found</h2>";
    console.error(err);
  });

// ===== CHAT FUNCTIONS =====

function initializeChat() {
  // Set tracking number in chat
  chatTrackingNumber.textContent = tn;
  
  // Show chat FAB
  chatFab.classList.remove('hidden');
  
  // Setup event listeners
  chatFab.addEventListener('click', toggleChat);
  chatCloseBtn.addEventListener('click', closeChat);
  chatSendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // Get or create conversation
  getOrCreateConversation();
}

async function getOrCreateConversation() {
  try {
    console.log('Getting/creating conversation for:', tn); // Debug log
    const res = await fetch(`/api/chat/conversations/${tn}`);
    if (!res.ok) throw new Error('Failed to get conversation');
    
    const conversation = await res.json();
    console.log('Conversation:', conversation); // Debug log
    conversationId = conversation._id;
    
    // Load messages
    await loadMessages();
    
    // Start auto-refresh
    startAutoRefresh();
  } catch (err) {
    console.error('Error getting conversation:', err);
  }
}

async function loadMessages() {
  if (!conversationId) return;
  
  try {
    console.log('Loading messages for conversation:', conversationId); // Debug log
    const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);
    if (!res.ok) throw new Error('Failed to load messages');
    
    const messages = await res.json();
    console.log('Loaded messages:', messages); // Debug log
    renderMessages(messages);
    
    // Update unread badge
    updateUnreadCount(messages);
  } catch (err) {
    console.error('Error loading messages:', err);
  }
}

function renderMessages(messages) {
  if (messages.length === 0) {
    chatMessages.innerHTML = '';
    return;
  }
  
  chatMessages.innerHTML = messages.map(msg => {
    const isUser = msg.sender === 'user';
    const time = formatTime(msg.createdAt);
    
    return `
      <div class="message ${isUser ? 'user' : 'admin'}">
        <div class="message-content">${escapeHtml(msg.content)}</div>
        <div class="message-time">${time}</div>
      </div>
    `;
  }).join('');
  
  scrollToBottom();
}

async function sendMessage() {
  const content = chatInput.value.trim();
  if (!content || !conversationId) {
    console.log('Cannot send: content or conversationId missing', { content, conversationId }); // Debug log
    return;
  }
  
  console.log('Sending message:', { conversationId, content }); // Debug log
  
  // Clear input
  chatInput.value = '';
  
  try {
    const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        sender: 'user'
      })
    });
    
    console.log('Send response status:', res.status); // Debug log
    
    if (!res.ok) throw new Error('Failed to send message');
    
    const result = await res.json();
    console.log('Message sent:', result); // Debug log
    
    // Reload messages
    await loadMessages();
  } catch (err) {
    console.error('Error sending message:', err);
    showSystemMessage('Failed to send message. Please try again.');
  }
}

function toggleChat() {
  const isOpen = chatWindow.classList.contains('open');
  
  if (isOpen) {
    closeChat();
  } else {
    openChat();
  }
}

function openChat() {
  chatWindow.classList.add('open');
  chatFab.style.transform = 'scale(0)';
  scrollToBottom();
  
  // Mark messages as read when opening
  if (conversationId) {
    markAsRead();
  }
  
  // Focus input
  setTimeout(() => chatInput.focus(), 300);
}

function closeChat() {
  chatWindow.classList.remove('open');
  chatFab.style.transform = 'scale(1)';
}

async function markAsRead() {
  if (!conversationId) return;
  
  try {
    await fetch(`/api/chat/conversations/${conversationId}/read`, {
      method: 'PUT'
    });
    
    // Hide badge
    chatBadge.classList.remove('show');
    chatBadge.textContent = '0';
  } catch (err) {
    console.error('Error marking as read:', err);
  }
}

function updateUnreadCount(messages) {
  const unreadMessages = messages.filter(msg => msg.sender === 'admin' && !msg.read);
  const count = unreadMessages.length;
  
  if (count > 0) {
    chatBadge.textContent = count;
    chatBadge.classList.add('show');
  } else {
    chatBadge.classList.remove('show');
  }
}

function showSystemMessage(text) {
  const systemMsg = document.createElement('div');
  systemMsg.className = 'message system';
  systemMsg.textContent = text;
  chatMessages.appendChild(systemMsg);
  scrollToBottom();
}

function scrollToBottom() {
  chatBody.scrollTop = chatBody.scrollHeight;
}

function startAutoRefresh() {
  chatRefreshInterval = setInterval(() => {
    if (conversationId) {
      loadMessages();
    }
  }, 5000); // Refresh every 5 seconds
}

function stopAutoRefresh() {
  if (chatRefreshInterval) {
    clearInterval(chatRefreshInterval);
    chatRefreshInterval = null;
  }
}

// Format time
function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    if (conversationId) {
      loadMessages();
      startAutoRefresh();
    }
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
});
