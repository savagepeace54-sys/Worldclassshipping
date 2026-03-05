// ===== ADMIN CHAT SYSTEM =====

const API_BASE = '/api/chat';
let currentChatId = null;
let currentTrackingNumber = null;
let chats = [];
let refreshInterval = null;

// DOM Elements
const chatList = document.getElementById('chatList');
const chatMessages = document.getElementById('chatMessages');
const chatHeader = document.getElementById('chatHeader');
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

// Initialize
 document.addEventListener('DOMContentLoaded', () => {
  loadChats();
  startAutoRefresh();
  setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
  sendBtn.addEventListener('click', sendMessage);
  
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  messageInput.addEventListener('input', autoResize);

  searchInput.addEventListener('input', (e) => {
    filterChats(e.target.value);
  });

  closeChatBtn.addEventListener('click', closeCurrentChat);
  deleteChatBtn.addEventListener('click', deleteCurrentChat);
}

// Load all chats
async function loadChats() {
  try {
    const res = await fetch(`${API_BASE}/conversations`);
    if (!res.ok) throw new Error('Failed to load chats');
    
    chats = await res.json();
    renderChatList();
    updateTotalUnread();
  } catch (err) {
    console.error('Error loading chats:', err);
    showToast('Failed to load chats', 'error');
  }
}

// Render chat list
function renderChatList() {
  if (chats.length === 0) {
    chatList.innerHTML = `
      <div class="empty-state">
        <p>No active chats</p>
      </div>
    `;
    return;
  }

  chatList.innerHTML = chats.map(chat => {
    const lastMessage = chat.lastMessage || {};
    const unreadCount = chat.unreadCount || 0;
    const isActive = chat._id === currentChatId;
    const initials = chat.trackingNumber ? chat.trackingNumber.substring(0, 2) : '??';
    const time = lastMessage.createdAt ? formatTime(lastMessage.createdAt) : '';
    
    return `
      <div class="chat-item ${isActive ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}" 
           data-id="${chat._id}" 
           onclick="selectChat('${chat._id}')">
        <div class="chat-avatar">${initials}</div>
        <div class="chat-info">
          <div class="chat-name">${chat.trackingNumber || 'Unknown'}</div>
          <div class="chat-preview">${lastMessage.content || 'No messages yet'}</div>
        </div>
        <div class="chat-meta">
          <div class="chat-time">${time}</div>
          ${unreadCount > 0 ? `<span class="chat-unread">${unreadCount}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Select a chat
async function selectChat(chatId) {
  currentChatId = chatId;
  const chat = chats.find(c => c._id === chatId);
  
  if (chat) {
    currentTrackingNumber = chat.trackingNumber;
    chatTitle.textContent = `Tracking: ${chat.trackingNumber}`;
    chatSubtitle.textContent = `Started: ${formatDate(chat.createdAt)}`;
    chatInputArea.style.display = 'block';
    
    // Update active state in list
    document.querySelectorAll('.chat-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-id="${chatId}"]`)?.classList.add('active');
    
    await loadMessages(chatId);
    await markAsRead(chatId);
  }
}

// Load messages for a chat
async function loadMessages(chatId) {
  try {
    const res = await fetch(`${API_BASE}/conversations/${chatId}/messages`);
    if (!res.ok) throw new Error('Failed to load messages');
    
    const messages = await res.json();
    renderMessages(messages);
  } catch (err) {
    console.error('Error loading messages:', err);
    showToast('Failed to load messages', 'error');
  }
}

// Render messages
function renderMessages(messages) {
  if (messages.length === 0) {
    chatMessages.innerHTML = `
      <div class="empty-chat">
        <div class="empty-icon">💬</div>
        <p>No messages yet. Start the conversation!</p>
      </div>
    `;
    return;
  }

  chatMessages.innerHTML = messages.map(msg => {
    const isAdmin = msg.sender === 'admin';
    const time = formatTime(msg.createdAt);
    const sender = isAdmin ? 'You (Admin)' : 'Customer';
    
    return `
      <div class="message ${isAdmin ? 'sent' : 'received'}">
        <div class="message-header">${sender}</div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
        <div class="message-time">${time}</div>
      </div>
    `;
  }).join('');

  scrollToBottom();
}

// Send message
async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !currentChatId) return;

  try {
    const res = await fetch(`${API_BASE}/conversations/${currentChatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        sender: 'admin'
      })
    });

    if (!res.ok) throw new Error('Failed to send message');

    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Reload messages
    await loadMessages(currentChatId);
    await loadChats(); // Refresh chat list
  } catch (err) {
    console.error('Error sending message:', err);
    showToast('Failed to send message', 'error');
  }
}

// Mark chat as read
async function markAsRead(chatId) {
  try {
    await fetch(`${API_BASE}/conversations/${chatId}/read`, {
      method: 'PUT'
    });
    
    // Update local state
    const chat = chats.find(c => c._id === chatId);
    if (chat) {
      chat.unreadCount = 0;
      renderChatList();
      updateTotalUnread();
    }
  } catch (err) {
    console.error('Error marking as read:', err);
  }
}

// Close current chat
async function closeCurrentChat() {
  if (!currentChatId) return;

  if (!confirm('Are you sure you want to close this chat?')) return;

  try {
    const res = await fetch(`${API_BASE}/conversations/${currentChatId}/close`, {
      method: 'PUT'
    });

    if (!res.ok) throw new Error('Failed to close chat');

    showToast('Chat closed successfully', 'success');
    resetChatView();
    await loadChats();
  } catch (err) {
    console.error('Error closing chat:', err);
    showToast('Failed to close chat', 'error');
  }
}

// Delete current chat
async function deleteCurrentChat() {
  if (!currentChatId) return;

  if (!confirm('Are you sure you want to delete this chat? This cannot be undone.')) return;

  try {
    const res = await fetch(`${API_BASE}/conversations/${currentChatId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete chat');

    showToast('Chat deleted successfully', 'success');
    resetChatView();
    await loadChats();
  } catch (err) {
    console.error('Error deleting chat:', err);
    showToast('Failed to delete chat', 'error');
  }
}

// Reset chat view
function resetChatView() {
  currentChatId = null;
  currentTrackingNumber = null;
  chatTitle.textContent = 'Select a chat';
  chatSubtitle.textContent = 'Click on a conversation to start';
  chatInputArea.style.display = 'none';
  chatMessages.innerHTML = `
    <div class="empty-chat">
      <div class="empty-icon">💬</div>
      <p>Select a conversation from the sidebar</p>
    </div>
  `;
}

// Filter chats
function filterChats(query) {
  const items = document.querySelectorAll('.chat-item');
  items.forEach(item => {
    const name = item.querySelector('.chat-name').textContent.toLowerCase();
    if (name.includes(query.toLowerCase())) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// Update total unread count
function updateTotalUnread() {
  const total = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
  totalUnreadBadge.textContent = total;
  totalUnreadBadge.style.display = total > 0 ? 'inline-block' : 'none';
}

// Auto-resize textarea
function autoResize() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
}

// Scroll to bottom of messages
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Format time
function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show toast notification
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Auto-refresh chats
function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    if (currentChatId) {
      loadMessages(currentChatId);
    }
    loadChats();
  }, 5000); // Refresh every 5 seconds
}

// Stop auto-refresh when page is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(refreshInterval);
  } else {
    startAutoRefresh();
    loadChats();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  clearInterval(refreshInterval);
});
