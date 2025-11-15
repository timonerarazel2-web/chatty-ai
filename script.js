// --- API Configuration and Instructions ---

// NOTE: This API Key is for demonstration purposes as requested by the prompt.
const API_KEY = ""; // Kept empty as per instructions. Canvas runtime will provide
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=";

const SYSTEM_INSTRUCTION = "Palaging sumagot sa natural na Tagalog. Maging friendly, helpful, at malinaw. Huwag magbigay ng fake information.";
const CHAT_HISTORY_KEY = 'chattyAiHistory';

// --- DOM Elements ---
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalMessage = document.getElementById('modal-message');
const modalRetryBtn = document.getElementById('modal-retry-btn');

let isSending = false; // Prevents multiple submissions

// --- Utility Functions ---

/**
 * Handles the logic for sending a message:
 * 1. Checks if a message is being processed.
 * 2. Collects user input and current chat history.
 * 3. Updates UI with user message and typing indicator.
 * 4. Calls the Gemini API.
 * 5. Updates UI with the AI response or an error.
 */
async function handleSend(retryMessage = null) {
    if (isSending) return;

    const userMessage = retryMessage || userInput.value.trim();
    if (userMessage === '') return;

    // 1. Reset and disable UI
    userInput.value = '';
    userInput.style.height = 'auto'; // Reset height
    isSending = true;
    sendBtn.disabled = true;

    // 2. Display user message (unless it's a retry of a previous message)
    if (!retryMessage) {
        appendMessage(userMessage, 'user');
        saveHistory();
    }

    // 3. Show typing indicator
    const typingIndicatorElement = showTypingIndicator();
    let aiResponse = '';
    let success = false;
    
    // Use the maximum number of retries for exponential backoff
    const maxRetries = 3;
    let delay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            aiResponse = await sendToGemini(userMessage);
            if (aiResponse !== "Walang response.") {
                success = true;
                break; // Exit loop on success
            }
        } catch (error) {
            console.error("API Call Attempt Failed:", error);
        }

        if (attempt < maxRetries - 1) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }

    // 4. Cleanup typing indicator
    removeTypingIndicator(typingIndicatorElement);

    // 5. Display AI response or error
    if (success) {
        appendMessage(aiResponse, 'model');
    } else {
        appendMessage("Paumanhin, nagkaroon ng error sa koneksyon o walang tugon mula sa AI. Pindutin ang 'Subukan Ulit' para muling ipadala ang mensahe.", 'error');
        showModal('Error sa API', 'Hindi makuha ang tugon mula sa Gemini. Subukan Ulit?', userMessage);
    }

    // 6. Reset state
    isSending = false;
    sendBtn.disabled = false;
    saveHistory();
}

/**
 * Fetches the conversation history from the DOM and formats it for the Gemini API payload.
 * @returns {Array} Array of contents objects for the API.
 */
function getChatHistoryForAPI() {
    const messages = chatWindow.querySelectorAll('.message:not(.typing-indicator-container)');
    const contents = [];

    messages.forEach(msg => {
        const type = msg.classList.contains('user') ? 'user' : 'model';
        const text = msg.querySelector('.text-content p').textContent;

        // Skip the initial greeting message
        if (msg.classList.contains('initial-message') && type === 'model') return;

        // The model role should be 'model' in the contents array
        const role = (type === 'user') ? 'user' : 'model';

        contents.push({
            role: role,
            parts: [{ text: text }]
        });
    });

    return contents;
}


/**
 * Calls the Gemini API with the full conversation context.
 * @param {string} newMessage The latest message from the user.
 * @returns {string} The AI's generated text response.
 */
async function sendToGemini(newMessage) {
    const conversationHistory = getChatHistoryForAPI();

    // Append the new user message to the history for the current request
    conversationHistory.push({ role: "user", parts: [{ text: newMessage }] });

    const payload = {
        contents: conversationHistory,
        // Inject the required Tagalog system instruction
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
        },
    };

    const url = API_URL + API_KEY;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        // Check if the response contains text and return it
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Walang response.";

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw error; // Re-throw to be caught by handleSend's retry loop
    }
}


// --- UI Manipulation ---

/**
 * Creates and appends a new message bubble to the chat window.
 * @param {string} text The message content.
 * @param {'user' | 'model' | 'error'} type The message type.
 */
function appendMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    const icon = document.createElement('i');

    if (type === 'user') {
        icon.className = 'fas fa-user';
    } else {
        icon.className = 'fas fa-robot';
    }
    avatar.appendChild(icon);

    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    textContent.innerHTML = `<p>${text}</p>`;

    // Arrange elements based on type
    if (type === 'user') {
        messageDiv.append(textContent, avatar);
    } else {
        messageDiv.append(avatar, textContent);
    }

    chatWindow.appendChild(messageDiv);
    autoScroll();
}

/**
 * Creates and displays the AI typing animation.
 * @returns {HTMLElement} The container element for the typing indicator.
 */
function showTypingIndicator() {
    const indicatorContainer = document.createElement('div');
    indicatorContainer.className = 'message model typing-indicator-container';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    const icon = document.createElement('i');
    icon.className = 'fas fa-robot';
    avatar.appendChild(icon);

    const textContent = document.createElement('div');
    textContent.className = 'text-content typing-indicator';
    textContent.innerHTML = `
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
    `;

    indicatorContainer.append(avatar, textContent);
    chatWindow.appendChild(indicatorContainer);
    autoScroll();
    return indicatorContainer;
}

/**
 * Removes the typing animation from the chat window.
 * @param {HTMLElement} element The typing indicator container element.
 */
function removeTypingIndicator(element) {
    if (element && chatWindow.contains(element)) {
        chatWindow.removeChild(element);
    }
}

/**
 * Scrolls the chat window to the bottom.
 */
function autoScroll() {
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * Automatically adjusts the height of the textarea.
 * @param {HTMLTextAreaElement} element The textarea element.
 */
function autoExpand(element) {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
}

/**
 * Shows a modal for errors or loading.
 * @param {string} title The modal title/heading.
 * @param {string} message The main message content.
 * @param {string} [retryMessage=null] The message to re-send if retry is clicked.
 */
function showModal(title, message, retryMessage = null) {
    modalMessage.innerHTML = `<strong>${title}</strong><br>${message}`;
    modalBackdrop.classList.remove('hidden');

    if (retryMessage) {
        modalRetryBtn.classList.remove('hidden');
        modalRetryBtn.onclick = () => {
            hideModal();
            handleSend(retryMessage);
        };
    } else {
        modalRetryBtn.classList.add('hidden');
    }
}

/**
 * Hides the modal.
 */
function hideModal() {
    modalBackdrop.classList.add('hidden');
}

// --- History Management (Local Storage) ---

/**
 * Saves the current chat history to local storage.
 */
function saveHistory() {
    const messages = chatWindow.innerHTML;
    try {
        localStorage.setItem(CHAT_HISTORY_KEY, messages);
    } catch (e) {
        console.warn("Local storage is unavailable. History won't be saved.");
    }
}

/**
 * Loads and displays chat history from local storage.
 */
function loadHistory() {
    try {
        const history = localStorage.getItem(CHAT_HISTORY_KEY);
        if (history) {
            chatWindow.innerHTML = history;
            autoScroll();
        }
    } catch (e) {
        console.warn("Could not load history from local storage.");
    }
}

/**
 * Starts a new chat session, clears history, and resets the UI.
 */
function newChat() {
    if (confirm("Gusto mo bang magsimula ng Bagong Chat? Tatanggalin nito ang kasalukuyang kasaysayan.")) {
        localStorage.removeItem(CHAT_HISTORY_KEY);
        chatWindow.innerHTML = `
            <div class="message model initial-message">
                <div class="avatar"><i class="fas fa-robot"></i></div>
                <div class="text-content">
                    <p>Kumusta! Ako si Chatty AI, handang sumagot sa Tagalog. Ano ang maitutulong ko sa iyo ngayon?</p>
                </div>
            </div>
        `;
        userInput.value = '';
        userInput.style.height = 'auto';
        autoScroll();
    }
}

// --- Event Listeners and Initialization ---

// 1. Send message on Enter key press
userInput.addEventListener('keydown', (event) => {
    // Check if Enter is pressed and shift key is NOT pressed
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent new line in textarea
        handleSend();
    }
    // Auto expand on keydown
    autoExpand(userInput);
});

// 2. Load history on page load
window.onload = loadHistory;
