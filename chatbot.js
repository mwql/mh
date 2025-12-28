/**
 * GEMINI AI CHATBOT LOGIC
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
const DEFAULT_GEMINI_KEY = "AIzaSyC2yBUSJolXFpCVzPbM2f0yuhIFApaonOA";

let chatHistory = [];
let isTyping = false;

// 1. Toggle Chatbot Window
window.toggleChatbot = function() {
    const window = document.getElementById('chatbot-window');
    window.classList.toggle('active');
    
    if (window.classList.contains('active')) {
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
    input.value = '';
    
    // Add to History
    chatHistory.push({ role: "user", parts: [{ text: message }] });
    
    // Show Typing Indicator
    showTypingIndicator();
    
    try {
        const response = await callGeminiAPI(message);
        hideTypingIndicator();
        addMessageToUI('ai', response);
        chatHistory.push({ role: "model", parts: [{ text: response }] });
    } catch (error) {
        hideTypingIndicator();
        let errorMsg = "Sorry, I encountered an error. Please try again later.";
        
        if (error.message.includes('429')) {
            errorMsg = "I'm receiving too many requests right now. Please wait a moment and try again.";
        } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMsg = "Invalid API Key. Please check your Gemini Key in the admin panel.";
        } else if (error.message.includes('404')) {
            errorMsg = "AI Model not found. Please contact support.";
        } else {
            errorMsg = `Error: ${error.message}. Please try again.`;
        }
        
        addMessageToUI('ai', errorMsg);
        console.error("Gemini Error:", error);
    }
}

// 3. Add Message to UI
function addMessageToUI(sender, text) {
    const messagesContainer = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    
    // Convert basic markdown to HTML for better readability
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Bold
        .replace(/\n/g, '<br>'); // Newlines
        
    msgDiv.innerHTML = formattedText;
    messagesContainer.appendChild(msgDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 4. Typing Indicator
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

// 5. Call Gemini API
async function callGeminiAPI(userPrompt) {
    // A. Get API Key (localStorage fallback to default)
    let apiKey = localStorage.getItem('geminiAIKey') || DEFAULT_GEMINI_KEY;
    
    // Try to find in sync predictions if not in localStorage
    const predictionsRaw = localStorage.getItem('weatherPredictions');
    if (predictionsRaw) {
        try {
            const predictions = JSON.parse(predictionsRaw);
            const geminiConfig = predictions.find(p => p.condition === '__GEMINI_CONFIG__');
            if (geminiConfig && geminiConfig.notes) {
                apiKey = geminiConfig.notes;
            }
        } catch (e) {}
    }

    // B. Get Weather Context
    const context = getWeatherContext();
    
    // C. Construct System Instruction (Conversational & Friendly)
    const systemInstruction = `You are "Mahdawi AI", a friendly and helpful weather assistant for the "Mahdawi Weather" website.
    
    Your goal is to chat with the user naturally and answer their questions about the weather based on the official data below.
    
    Current Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
    
    OFFICIAL FORECAST DATA:
    ${context}
    
    BEHAVIOR GUIDELINES:
    1. **Be Conversational**: If the user says "Hello", "Hi", or asks "How are you?", reply warmly. You don't always have to talk about weather immediately.
    2. **Use the Data**: When asked about the weather (e.g., "What's the weather tomorrow?", "Is it raining this week?"), look at the OFFICIAL FORECAST DATA above.
       - If you find data for that date, summarize it clearly (Temperature, Condition, Notes).
       - If you DO NOT find data for that date, simply say "I don't have a forecast for that specific day yet."
    3. **Language**: Always reply in the same language the user speaks (Arabic or English).
    4. **Tone**: Be polite, concise, and helpful. You can use emojis (🌤️, 🌧️) to make it friendly.
    5. **Formatting**: You can use bolding for emphasis, but keep it clean.
    `;

    // D. Prepare Payload
    const payload = {
        contents: [
            {
                role: "user",
                parts: [{ text: systemInstruction }]
            },
            {
                role: "model",
                parts: [{ text: "Understood! I am ready to chat and help with weather updates." }]
            },
            ...chatHistory
        ],
        generationConfig: {
            temperature: 0.9, // Higher temperature for more natural conversation
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
        }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// 6. Get Weather Context from Local Data
function getWeatherContext() {
    const raw = localStorage.getItem('weatherPredictions');
    if (!raw) return "No forecast data available at the moment.";
    
    try {
        const predictions = JSON.parse(raw);
        // Filter out config items
        const actualForecasts = predictions.filter(p => {
            const cond = (p.condition || '').trim();
            return !cond.startsWith('__');
        });
        
        if (actualForecasts.length === 0) return "No official forecasts currently listed.";
        
        return actualForecasts.map(p => {
            return `- Date: ${p.date}${p.toDate ? ' to ' + p.toDate : ''}, Temp: ${p.temperature}°C, Condition: ${p.condition}, Notes: ${p.notes || 'None'}, City: ${p.city || 'Kuwait'}, Uploader: ${p.uploader || 'Admin'}`;
        }).join('\n');
        
    } catch (e) {
        return "Error parsing weather data.";
    }
}
