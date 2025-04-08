document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.querySelector(".chat-box");
    const welcomeScreen = document.getElementById("welcome-screen");
    const startButton = document.getElementById("start-chatting");
    const clearChatButtonSidebar = document.getElementById("clear-chat-sidebar");
    const settingsButtonSidebar = document.getElementById("settings-button");
    const aboutButtonSidebar = document.getElementById("about-button");
    const sidebarToggle = document.querySelector(".sidebar-toggle");
    const sidebar = document.querySelector(".sidebar");
    const fileAttachButton = document.querySelector(".file-attach");
    const fileInput = document.getElementById("file-upload");
    const inputArea = document.getElementById("input-area");
    const inputPlaceholder = document.getElementById("input-placeholder");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");

    let attachedFile = null;

    const chatHistoryKey = "social_media_tracker_history";
    const firstMessageKey = "social_media_tracker_first_message";
    const GEMINI_API_KEY = "AIzaSyDPFeZ0ICUvJUstnM7oUCY1u53WfIsMr2Q";
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const socialMediaKeywords = ["engagement", "likes", "comments", "shares", "followers", "reach", "impressions", "analytics", "performance", "report", "campaign", "post", "content", "platform", "facebook", "instagram", "twitter", "linkedin", "youtube", "tiktok"];

    function loadChatHistory() {
        const history = JSON.parse(localStorage.getItem(chatHistoryKey)) || [];
        if (history.length > 0) {
            history.forEach(msg => addMessage(msg.text, msg.sender, false));
            chatBox.classList.add("has-messages");
            showInputSection();
        } else {
            chatBox.classList.remove("has-messages");
            welcomeScreen.style.display = "flex"; // Show welcome screen if no history
            hideInputSection(); // Show placeholder initially
        }
        scrollToBottom();
    }

    function storeChat(userInput, botResponse) {
        let history = JSON.parse(localStorage.getItem(chatHistoryKey)) || [];
        if (!localStorage.getItem(firstMessageKey)) {
            localStorage.setItem(firstMessageKey, userInput);
        }
        history.push({ text: userInput, sender: "user" });
        history.push({ text: botResponse, sender: "bot" });
        localStorage.setItem(chatHistoryKey, JSON.stringify(history));
    }

    function getFirstMessage() {
        return localStorage.getItem(firstMessageKey) || "I don't remember the first message.";
    }

    function getChatHistoryForContext() {
        let history = JSON.parse(localStorage.getItem(chatHistoryKey)) || [];
        const recentHistory = history.slice(-6);
        return recentHistory.map(entry => `${entry.sender}: ${entry.text}`).join("\n");
    }

    function handleSpecialQueries(userMessage) {
        const lowerCaseMessage = userMessage.toLowerCase();
        if (lowerCaseMessage.includes("first thing i said")) {
            return `The first thing you said in this conversation was: "${getFirstMessage()}".`;
        }
        return null;
    }

    async function fetchGeminiResponse(userMessage) {
        const typingIndicator = showTypingIndicator();

        let specialResponse = handleSpecialQueries(userMessage);
        if (specialResponse) {
            removeTypingIndicator(typingIndicator);
            addMessage(specialResponse, "bot");
            return;
        }

        let chatContext = getChatHistoryForContext();
        const systemMessage = `You are a helpful social media tracker assistant. You can also analyze images related to social media performance. Focus on keywords like engagement, likes, comments, shares, followers, reach, impressions, analytics, and specific platforms such as Facebook, Instagram, Twitter, LinkedIn, YouTube, and TikTok. When responding, provide informative and relevant answers based on both text and image content. If the user's query is outside this domain, gently steer them back or inform them you can only assist with social media tracking and related image analysis.`;

        const contents = [
            {
                role: "user",
                parts: [{ text: systemMessage }]
            },
            {
                role: "user",
                parts: [{ text: `Previous conversation:\n${chatContext}\nUser: ${userMessage}` }]
            }
        ];

        if (attachedFile) {
            if (attachedFile.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = async () => {
                    contents[1].parts.push({
                        inlineData: {
                            mimeType: attachedFile.type,
                            data: reader.result.split(',')[1]
                        }
                    });

                    try {
                        const response = await fetch(GEMINI_API_URL, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ contents })
                        });

                        removeTypingIndicator(typingIndicator);
                        const data = await response.json();

                        if (data.candidates && data.candidates.length > 0) {
                            const botReply = data.candidates[0]?.content?.parts?.[0]?.text || "I couldn't process that with the image. Try again!";
                            addMessage(botReply, "bot");
                            storeChat(userMessage, botReply);
                        } else {
                            addMessage("I couldn't process that with the image. Try again!", "bot");
                        }
                        attachedFile = null;
                    } catch (error) {
                        removeTypingIndicator(typingIndicator);
                        addMessage("Oops! Something went wrong with the image upload. Try again later.", "bot");
                        console.error("Gemini API Error:", error);
                        attachedFile = null;
                    }
                };
                reader.readAsDataURL(attachedFile);
                return;
            } else {
                removeTypingIndicator(typingIndicator);
                addMessage("Only image files are currently supported.", "bot");
                attachedFile = null;
                return;
            }
        }

        try {
            const response = await fetch(GEMINI_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents })
            });

            removeTypingIndicator(typingIndicator);
            const data = await response.json();

            if (data.candidates && data.candidates.length > 0) {
                const botReply = data.candidates[0]?.content?.parts?.[0]?.text || "I couldn't process that. Try again!";
                addMessage(botReply, "bot");
                storeChat(userMessage, botReply);
            } else {
                addMessage("I couldn't process that. Try again!", "bot");
            }
        } catch (error) {
            removeTypingIndicator(typingIndicator);
            addMessage("Oops! Something went wrong. Try again later.", "bot");
            console.error("Gemini API Error:", error);
        }
    }

    function clearChatHistory() {
        localStorage.removeItem(chatHistoryKey);
        localStorage.removeItem(firstMessageKey);
        chatBox.innerHTML = ""; // Clear the chat messages
        chatBox.classList.remove("has-messages"); // Remove the "has-messages" class
        welcomeScreen.style.display = "flex"; // Show the welcome screen
        hideInputSection(); // Reset input area to placeholder state
        console.log("Chat cleared, welcome screen shown, input hidden.");
        // Force re-bind and immediate trigger if needed
        startButton.addEventListener("click", handleStartChatting);
        handleStartChatting(); // Attempt to show input immediately after clear
    }

    function showSettings() {
        alert("Settings functionality will be implemented here.");
        toggleSidebar();
    }

    function showAbout() {
        alert("About this AI Chatbot.\n\n(You can add details here)");
        toggleSidebar();
    }

    function addMessage(content, sender = "user", save = true) {
        if (!content.trim()) return;

        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", sender === "user" ? "user-message" : "bot-message");
        messageDiv.innerText = content;

        chatBox.appendChild(messageDiv);
        chatBox.classList.add("has-messages");
        scrollToBottom();

        if (save && sender === "bot") {
            storeChat(userInput.value, content);
        }
    }

    function showTypingIndicator() {
        const typingDiv = document.createElement("div");
        typingDiv.classList.add("message", "bot-message", "typing");
        typingDiv.innerText = "Bot is thinking about social media tracking...";
        chatBox.appendChild(typingDiv);
        scrollToBottom();
        return typingDiv;
    }

    function removeTypingIndicator(indicator) {
        if (indicator && indicator.parentNode === chatBox) {
            chatBox.removeChild(indicator);
            scrollToBottom();
        }
    }

    function sendMessage() {
        const messageText = userInput.value.trim();
        if (messageText === "" && !attachedFile) return;

        addMessage(messageText, "user");
        userInput.value = "";
        fetchGeminiResponse(messageText);
    }

    function scrollToBottom() {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function toggleSidebar() {
        sidebar.classList.toggle("collapsed");
    }

    function showInputSection() {
        inputPlaceholder.classList.add("hidden-input");
        userInput.classList.remove("hidden-input");
        sendButton.classList.remove("hidden-input");
        welcomeScreen.style.display = "none"; // Hide welcome screen
        userInput.focus();
        console.log("Input section shown.");
    }

    function hideInputSection() {
        inputPlaceholder.classList.remove("hidden-input");
        userInput.classList.add("hidden-input");
        sendButton.classList.add("hidden-input");
    }

    function handleStartChatting() {
        console.log("Start Chatting clicked.");
        showInputSection(); // Show input section when Start Chatting is clicked
    }

    // Initial event listener setup
    startButton.addEventListener("click", handleStartChatting);

    sendButton.addEventListener("click", sendMessage);
    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });

    sidebarToggle.addEventListener("click", toggleSidebar);
    clearChatButtonSidebar.addEventListener("click", clearChatHistory);
    settingsButtonSidebar.addEventListener("click", showSettings);
    aboutButtonSidebar.addEventListener("click", showAbout);

    fileAttachButton.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            attachedFile = selectedFile;
            addMessage(`File attached: ${selectedFile.name}`, "user", false);
        }
    });

    const exampleQueryItems = document.querySelectorAll(".example-queries li");
    exampleQueryItems.forEach(item => {
        item.addEventListener("click", () => {
            userInput.value = item.innerText;
            showInputSection();
            sendMessage();
        });
    });

    loadChatHistory();
});