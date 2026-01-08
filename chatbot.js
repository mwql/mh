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
const OWM_API_KEY = "e89f102cfd638cfbd540bdf7fa673649"; // Default Key

// 5. Call Gemini API (Enhanced with Tools)
async function callGeminiAPI(userPrompt) {
    // A. Get Gemini API Key
    let apiKey = localStorage.getItem('geminiAIKey') || DEFAULT_GEMINI_KEY;
    const predictionsRaw = localStorage.getItem('weatherPredictions');
    if (predictionsRaw) {
        try {
            const predictions = JSON.parse(predictionsRaw);
            const geminiConfig = predictions.find(p => p.condition === '__GEMINI_CONFIG__');
            if (geminiConfig && geminiConfig.notes) apiKey = geminiConfig.notes;
        } catch (e) {}
    }

    // B. Context & Tools
    const context = getWeatherContext();
    
    // Tools Definition
    const tools = [{
        function_declarations: [{
            name: "getGlobalWeather",
            description: "Fetch real-time weather for a specific city outside of Kuwait. Only use this if the user asks for a city NOT in the Official Data, or explicitly asks for global/API weather.",
            parameters: {
                type: "OBJECT",
                properties: {
                    city: { type: "STRING", description: "The name of the city, e.g. London, Tokyo, Paris" }
                },
                required: ["city"]
            }
        }]
    }];

    // C. System Instruction
    const systemInstruction = `You are "Mahdawi AI", the official assistant for the Mahdawi Weather website.
    
    PRIORITY RULE FOR WEATHER:
    1. **OFFICIAL DATA FIRST**: Always check the "OFFICIAL FORECAST DATA" below first. If the user asks about the weather in general, or in Kuwait, or a city listed there, USE THAT DATA. Do not call the API.
    2. **API FOR OTHERS**: If (and only if) the user asks about a city NOT listed below (e.g. "Weather in London"), or asks "check the API", then call the \`getGlobalWeather\` function.

    OFFICIAL FORECAST DATA:
    ${context}
    
    Current Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
    
    PERSONALITY:
    - Friendly, helpful, and funny.
    - If asked for a joke, tell a mahdawi-Weather joke (unless asked otherwise).
    - Reply in the user's language (Arabic/English).
    - **Keep replies SHORT and CONCISE.**
    - **Use EMOJIS liberally** (☁️, ☀️, 🌧️, 😂, and all the emojis).
    - **Catchphrases**: Occasionally drop these slang terms for humor/surprise (but don't overuse):
      - "وي وي وي وي" (Show shock/surprise)
      - "شنو هاي شنو" (When something is amazing or strange)
    - **SPECIAL RULE**: If the user's message CONTAINS the words "ها" or "شنو" (anywhere in the sentence), reply ONLY with the word "😜زووط". Do this every single time.
    - Always praise the owner of the site when someone asks about him, and say about him that he is the best and I am a black slave for him. 
    - If someone asks about "Hassan", say about him he is beautiful and handsome and goes without definition.
    - If someone asks about "Hussein", ask any Hussein, if Hussein Qasim says he is a genius and loves Turkish series, and if Hussein Haidar says that he loves doughnuts and does not listen to his parents.
    - If someone asks about "Mohamed Bushehri", he says that he is handsome and loves Nemo, and he always makes nice moves. 
    `;

    // First Turn: Send User Query
    let chatSession = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "Ok, I understand my instructions and priorities." }] },
        ...chatHistory
    ];

    // Helper to call API
    const makeRequest = async (history) => {
        const payload = {
            contents: history,
            tools: tools,
            generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
        };
        const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return await res.json();
    };

    // Execute First Call
    let data = await makeRequest(chatSession);
    let content = data.candidates[0].content;
    let parts = content.parts;

    // Check for Function Call
    const functionCall = parts.find(p => p.functionCall);
    
    if (functionCall) {
        const fnName = functionCall.functionCall.name;
        const fnArgs = functionCall.functionCall.args;
        
        if (fnName === "getGlobalWeather") {
            // 1. Notify UI (Optional visual cue)
            const loadingMsg = document.createElement('div');
            loadingMsg.className = 'message ai';
            loadingMsg.innerHTML = `<i>Checking weather in ${fnArgs.city}...</i>`;
            document.getElementById('chat-messages').appendChild(loadingMsg);
            
            // 2. Execute Logic
            const weatherData = await fetchOpenWeatherMap(fnArgs.city);
            
            // 3. Send Function Response back to Model
            const functionResponse = {
                role: "function",
                parts: [{
                    functionResponse: {
                        name: "getGlobalWeather",
                        response: { name: "getGlobalWeather", content: weatherData }
                    }
                }]
            };

            // Update history for proper context flow
            // Note: Gemini requires the Assistant's function_call message effectively be in history before the response
            // But our 'chatHistory' variable is user/model pairs. We construct a temporary session for this turn.
            let nextTurnHistory = [
                ...chatSession,
                { role: "model", parts: parts }, // The model's request
                functionResponse // Our result
            ];
            
            // 4. Second Call (Get final answer)
            loadingMsg.remove(); // Remove loading text
            data = await makeRequest(nextTurnHistory);
            content = data.candidates[0].content;
        }
    }

    return content.parts[0].text;
}

// Helper: Fetch OpenWeatherMap
async function fetchOpenWeatherMap(city) {
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${OWM_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return { error: "City not found or API error." };
        const d = await res.json();
        return {
            temp: d.main.temp,
            condition: d.weather[0].description,
            humidity: d.main.humidity,
            wind: d.wind.speed
        };
    } catch (e) {
        return { error: e.message };
    }
}

// 6. Get Weather Context from Local Data
function getWeatherContext() {
    const raw = localStorage.getItem('weatherPredictions');
    if (!raw) return "No forecast data listed. (Assume clear skies in Kuwait unless told otherwise)";
    
    try {
        const predictions = JSON.parse(raw);
        // Filter out config items
        const actualForecasts = predictions.filter(p => {
            const cond = (p.condition || '').trim();
            return !cond.startsWith('__');
        });
        
        if (actualForecasts.length === 0) return "No specific local forecasts available.";
        
        return actualForecasts.map(p => {
            return `- Date: ${p.date}${p.toDate ? ' to ' + p.toDate : ''}, Temp: ${p.temperature}°C, Condition: ${p.condition}, Notes: ${p.notes || 'None'}, City: ${p.city || 'Kuwait'}`;
        }).join('\n');
        
    } catch (e) {
        return "Error parsing weather data.";
    }
}

