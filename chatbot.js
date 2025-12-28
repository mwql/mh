/**
 * LOCAL FORECAST CHATBOT LOGIC
 * Responds from stored forecasts without external API calls
 */

let chatHistory = [];
let isTyping = false;

// 1. Toggle Chatbot Window
window.toggleChatbot = function() {
    const chatWindow = document.getElementById('chatbot-window');
    chatWindow.classList.toggle('active');
    
    if (chatWindow.classList.contains('active')) {
        document.getElementById('chat-input').focus();
    }
}

// 2. Send Message
window.sendChatMessage = async function() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message || isTyping) return;
    
    // Add User Message to UI
    addMessageToUI('user', message);
    chatHistory.push({ role: 'user', text: message });
    input.value = '';
    
    // Show Typing Indicator
    showTypingIndicator();
    
    // Simulate slight delay for natural feel
    setTimeout(() => {
        const response = generateLocalResponse(message);
        hideTypingIndicator();
        addMessageToUI('ai', response);
        chatHistory.push({ role: 'ai', text: response });
    }, 300);
}

// 3. Generate Response from Local Data
function generateLocalResponse(userMessage) {
    const msg = userMessage.toLowerCase();
    
    // Get forecasts from localStorage
    const forecasts = getStoredForecasts();
    
    // Handle greetings
    if (/^(hi|hello|hey|howdy|greetings)/i.test(msg)) {
        return `Hello! I can help you with weather forecasts. Try asking:\n• "What's the weather tomorrow?"\n• "Temperature on Jan 5?"\n• "Forecast for this week"`;
    }
    
    // Handle thanks
    if (/^(thanks|thank you|thx)/i.test(msg)) {
        return "You're welcome! Feel free to ask about any forecast dates.";
    }
    
    // Extract date from message
    const dateInfo = extractDateFromMessage(msg);
    
    if (!dateInfo) {
        return `I can help with weather forecasts! Ask me about specific dates like:\n• "Weather on December 30"\n• "What's the forecast for tomorrow?"\n• "Temperature this weekend"`;
    }
    
    // Find matching forecast
    const matchingForecasts = findForecastsByDate(forecasts, dateInfo);
    
    if (matchingForecasts.length === 0) {
        return `Sorry, I don't have forecast data for ${formatDateForDisplay(dateInfo)}. Available forecasts:\n${getAvailableDatesPreview(forecasts)}`;
    }
    
    // Format response
    return formatForecastResponse(matchingForecasts, dateInfo);
}

// 4. Extract Date from User Message
function extractDateFromMessage(msg) {
    const today = new Date();
    
    // Handle "today"
    if (/\btoday\b/.test(msg)) {
        return today;
    }
    
    // Handle "tomorrow"
    if (/\btomorrow\b/.test(msg)) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
    }
    
    // Handle "this week" / "week"
    if (/\b(this )?week\b/.test(msg)) {
        return 'week';
    }
    
    // Handle specific date patterns: "Dec 30", "December 30", "30 Dec"
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthRegex = new RegExp(`\\b(${monthNames.join('|')})[a-z]*\\s+(\\d{1,2})\\b`, 'i');
    const match1 = msg.match(monthRegex);
    
    if (match1) {
        const monthIndex = monthNames.indexOf(match1[1].toLowerCase().substring(0, 3));
        const day = parseInt(match1[2]);
        const year = today.getFullYear();
        return new Date(year, monthIndex, day);
    }
    
    // Handle "30th December", "5 Jan"
    const dayMonthRegex = new RegExp(`\\b(\\d{1,2})(st|nd|rd|th)?\\s+(${monthNames.join('|')})[a-z]*\\b`, 'i');
    const match2 = msg.match(dayMonthRegex);
    
    if (match2) {
        const day = parseInt(match2[1]);
        const monthIndex = monthNames.indexOf(match2[3].toLowerCase().substring(0, 3));
        const year = today.getFullYear();
        return new Date(year, monthIndex, day);
    }
    
    // Handle numeric dates: "12/30", "30-12", "2025-12-30"
    const numericRegex = /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/;
    const match3 = msg.match(numericRegex);
    
    if (match3) {
        return new Date(parseInt(match3[1]), parseInt(match3[2]) - 1, parseInt(match3[3]));
    }
    
    return null;
}

// 5. Find Forecasts by Date
function findForecastsByDate(forecasts, dateQuery) {
    if (dateQuery === 'week') {
        // Return all forecasts for the next 7 days
        const today = new Date();
        const weekLater = new Date(today);
        weekLater.setDate(weekLater.getDate() + 7);
        
        return forecasts.filter(f => {
            const fDate = new Date(f.date + 'T00:00:00');
            return fDate >= today && fDate <= weekLater;
        });
    }
    
    // Specific date
    const targetDate = formatDateYMD(dateQuery);
    
    return forecasts.filter(f => {
        // Check if date matches
        if (f.date === targetDate) return true;
        
        // Check if within date range
        if (f.toDate) {
            const startDate = new Date(f.date + 'T00:00:00');
            const endDate = new Date(f.toDate + 'T00:00:00');
            const queryDate = new Date(dateQuery);
            return queryDate >= startDate && queryDate <= endDate;
        }
        
        return false;
    });
}

// 6. Format Response
function formatForecastResponse(forecasts, dateInfo) {
    if (forecasts.length === 1) {
        const f = forecasts[0];
        let response = `Forecast for ${formatDateForDisplay(dateInfo)}:\n\n`;
        response += `🌡️ Temperature: ${f.temperature}°C\n`;
        response += `☁️ Condition: ${f.condition}\n`;
        if (f.city) response += `📍 City: ${f.city}\n`;
        if (f.uploader) response += `👤 By: ${f.uploader}\n`;
        if (f.notes) response += `📝 ${f.notes}`;
        return response;
    }
    
    // Multiple forecasts
    let response = `Found ${forecasts.length} forecasts:\n\n`;
    forecasts.forEach((f, i) => {
        const dateRange = f.toDate ? `${f.date} to ${f.toDate}` : f.date;
        response += `${i + 1}. ${f.condition} - ${f.temperature}°C (${dateRange})\n`;
    });
    return response;
}

// 7. Helper Functions
function getStoredForecasts() {
    const raw = localStorage.getItem('weatherPredictions');
    if (!raw) return [];
    
    try {
        const predictions = JSON.parse(raw);
        // Filter out config items
        return predictions.filter(p => {
            const cond = (p.condition || '').trim();
            return !cond.startsWith('__');
        });
    } catch (e) {
        return [];
    }
}

function formatDateYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateForDisplay(date) {
    if (date === 'week') return 'this week';
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function getAvailableDatesPreview(forecasts) {
    if (forecasts.length === 0) return 'No forecasts available.';
    const preview = forecasts.slice(0, 3).map(f => f.date).join(', ');
    return forecasts.length > 3 ? `${preview}, and ${forecasts.length - 3} more...` : preview;
}

// 8. UI Functions
function addMessageToUI(sender, text) {
    const messagesContainer = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.textContent = text;
    messagesContainer.appendChild(msgDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    isTyping = true;
    const messagesContainer = document.getElementById('chat-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai typing-indicator';
    typingDiv.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    typingDiv.id = 'typing-indicator';
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    isTyping = false;
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

