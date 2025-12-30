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
    // A. Get API Key
    let apiKey = localStorage.getItem('geminiAIKey') || DEFAULT_GEMINI_KEY;
    const predictionsRaw = localStorage.getItem('weatherPredictions');
    if (predictionsRaw) {
        try {
            const predictions = JSON.parse(predictionsRaw);
            const geminiConfig = predictions.find(p => p.condition === '__GEMINI_CONFIG__');
            if (geminiConfig && geminiConfig.notes) apiKey = geminiConfig.notes;
        } catch (e) {}
    }

    // B. Get Weather Context (Local Data)
    const context = getWeatherContext();

    // C. Define Tools (Function Calling)
    const tools = [{
        function_declarations: [{
            name: "get_weather",
            description: "Get real-time weather for a specific city. Call this ONLY if the user asks for a city OUTSIDE of Kuwait or explicitly asks to 'use API'.",
            parameters: {
                type: "OBJECT",
                properties: {
                    city: { type: "STRING", description: "The city name (e.g. London, Paris)" }
                },
                required: ["city"]
            }
        }]
    }];

    // D. System Instruction
    const systemInstruction = `You are "Mahdawi AI", a friendly weather assistant.
    
    Current Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
    
    OFFICIAL LOCAL DATA (PRIORITY #1):
    ${context}
    
    BEHAVIOR:
    1. **Check Local Data First**: Always look at the "OFFICIAL LOCAL DATA" above. If the user asks about Kuwait or general weather, use that data.
    2. **Use API Only When Necessary**: 
       - If the user asks for a specific city NOT in the local data (e.g. "Weather in London"), call the \`get_weather\` tool.
       - If the user explicitly says "use the API", call the \`get_weather\` tool.
    3. **Be Friendly**: Reply warmly to greetings.
    4. **Jokes**: Tell weather jokes if asked.
    5. **Language**: Match the user's language (Arabic/English).
    `;

    // E. Initial Chat Payload
    // We send specific 'user' and 'model' turns to set the stage, then append history
    // Note: Gemini API requires strict alternating roles in history. 
    // We'll trust chatHistory is well-formed or simple append here.
    
    // Construct the full history including system prompt as first user message (Best practice for Flash model)
    const fullHistory = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "Understood. I will prioritize local data and use the tool for other cities." }] },
        ...chatHistory
    ];

    const payload = {
        contents: fullHistory,
        tools: tools,
        generationConfig: {
            temperature: 0.7, 
            maxOutputTokens: 1024,
        }
    };

    // F. First Turn: Call Gemini
    let response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    let data = await response.json();
    let firstPart = data.candidates[0].content.parts[0];

    // G. Check for Function Call
    if (firstPart.functionCall) {
        const fnName = firstPart.functionCall.name;
        const args = firstPart.functionCall.args;
        
        if (fnName === "get_weather") {
            const cityName = args.city;
            addMessageToUI('ai', `🔎 Checking weather in ${cityName}...`); // Feedback to user
            
            // Execute Tool
            const weatherResult = await executeGetWeather(cityName);
            
            // H. Second Turn: Send Function Response back to Gemini
            const functionResponsePart = {
                functionResponse: {
                    name: "get_weather",
                    response: {
                        name: "get_weather",
                        content: weatherResult 
                    }
                }
            };
            
            // Append the model's function call and our response to history for this turn
            const turnHistory = [...fullHistory];
            // 1. Model's request
            turnHistory.push(data.candidates[0].content); 
            // 2. Our response
            turnHistory.push({ role: "function", parts: [functionResponsePart] });

            const secondPayload = {
                contents: turnHistory,
                tools: tools // Keep tools enabled (optional, but good for consistency)
            };

            const secondResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(secondPayload)
            });
            
            if (!secondResponse.ok) throw new Error("API Error on Function Response");
            const secondData = await secondResponse.json();
            return secondData.candidates[0].content.parts[0].text;
        }
    }

    // Default Text Return
    return firstPart.text;
}

// 7. Execute Get Weather Tool
async function executeGetWeather(city) {
    try {
        // Try to access the global function if available
        if (window.fetchLiveWeatherForCity) {
            const data = await window.fetchLiveWeatherForCity(city);
            if(data) {
                return { result: `Success: Weather in ${city} is ${data.temp}°C, ${data.desc}.` };
            }
        }
        
        // Fallback: Direct call if script.js isn't exposing it properly or fails
        // We duplicates logic slightly just to be safe and robust
        const key = "e89f102cfd638cfbd540bdf7fa673649"; // Default safe key
        const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${key}`);
        if(!r.ok) return { error: "City not found." };
        const d = await r.json();
        return { result: `Weather in ${d.name} is ${Math.round(d.main.temp)}°C, ${d.weather[0].description}.` };
        
    } catch (e) {
        return { error: "Failed to fetch weather." };
    }
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
