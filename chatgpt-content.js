// Constants
const GPT_ID = 'g-6749b358a57c8191a95344323c84c1e1-dich-truyen-tieng-trung-do-thi';

console.log('[Novel Translator] ChatGPT content script loaded');

// Check if we're on the correct GPT page
function isCorrectGPTPage() {
    const currentUrl = window.location.href;
    console.log('[Novel Translator] Checking URL:', { current: currentUrl, expected: GPT_ID });
    return currentUrl.includes('chatgpt.com') && currentUrl.includes(GPT_ID);
}

// Function to wait for element with multiple selectors
async function waitForElement(selectors, timeout = 30000, checkInterval = 1000) {
    if (!isCorrectGPTPage()) {
        console.log('[Novel Translator] Not on the correct GPT page, skipping');
        return null;
    }

    console.log('[Novel Translator] Waiting for elements:', selectors);
    const startTime = Date.now();
    
    // Log all available textareas and potential input elements for debugging
    function logAvailableElements() {
        console.log('[Novel Translator] Available elements:');
        console.log('Textareas:', document.querySelectorAll('textarea'));
        console.log('Contenteditable elements:', document.querySelectorAll('[contenteditable="true"]'));
        console.log('Input elements:', document.querySelectorAll('input[type="text"]'));
        console.log('Elements with "prompt" in class/id:', document.querySelectorAll('[class*="prompt"], [id*="prompt"]'));
    }
    
    async function checkElement() {
        // Log available elements every few attempts
        if ((Date.now() - startTime) % 5000 === 0) {
            logAvailableElements();
        }

        if (Array.isArray(selectors)) {
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    console.log('[Novel Translator] Found element with selector:', selector);
                    return element;
                }
            }
        } else {
            const element = document.querySelector(selectors);
            if (element) {
                console.log('[Novel Translator] Found element with selector:', selectors);
                return element;
            }
        }

        if (Date.now() - startTime >= timeout) {
            logAvailableElements(); // Log one final time before timeout
            console.error(`[Novel Translator] Elements ${Array.isArray(selectors) ? selectors.join(', ') : selectors} not found within ${timeout}ms`);
            throw new Error(`Elements ${Array.isArray(selectors) ? selectors.join(', ') : selectors} not found within ${timeout}ms`);
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
        return checkElement();
    }

    return checkElement();
}

// Function to wait for ChatGPT response
async function waitForChatGPTResponse(maxRetries = 3, timeout = 120000) {
    console.log('[Novel Translator] Waiting for ChatGPT response');
    
    try {
        // First wait for the response container
        const responseElement = await waitForElement([
            '[data-message-author-role="assistant"]'
        ], timeout);
        
        console.log('[Novel Translator] Found response container, waiting for action buttons');
        
        // Then wait for action buttons to appear (indicates response is complete)
        const actionButtons = await waitForElement([
            '[data-testid="voice-play-turn-action-button"]',
            '[data-testid="copy-turn-action-button"]'
        ], timeout);
        
        console.log('[Novel Translator] Action buttons found, extracting content');
        
        // Now get the markdown content
        const markdownElement = responseElement.querySelector('.markdown.prose');
        if (!markdownElement) {
            console.error('[Novel Translator] Could not find markdown content');
            return '';
        }

        // Get all paragraphs, including those after <hr> tags
        const paragraphs = Array.from(markdownElement.getElementsByTagName('p'));
        console.log('[Novel Translator] Found paragraphs:', paragraphs.length);
        
        // Filter out footer and empty paragraphs, and extract text
        const content = paragraphs
            .map(p => p.textContent.trim())
            .filter(text => text && !text.includes('Truyện được dịch bởi'))
            .join('\n');

        console.log('[Novel Translator] Raw content:', content);
        
        if (!content) {
            console.error('[Novel Translator] No valid content found');
            return '';
        }

        return content;
    } catch (error) {
        console.error('[Novel Translator] Error waiting for response:', error);
        throw error;
    }
}

// Function to inject content to ChatGPT input
async function injectContentToChatGPT(content) {
    console.log('[Novel Translator] Attempting to inject content');
    
    try {
        // Try multiple possible selectors
        const inputSelectors = [
            '#prompt-textarea',  // New primary selector
            'div[contenteditable="true"].ProseMirror',
            'textarea[placeholder*="Send a message"]',
            'textarea[placeholder*="Tin nhắn"]',
            '[contenteditable="true"]',
            'textarea.prompt-textarea',
            'textarea'
        ];
        
        const inputElement = await waitForElement(inputSelectors);
        
        if (!inputElement) {
            throw new Error('Could not find input element');
        }

        console.log('[Novel Translator] Found input element:', inputElement);

        // Handle both contenteditable div and textarea cases
        if (inputElement.getAttribute('contenteditable') === 'true') {
            inputElement.innerHTML = content;
            // Trigger input event for contenteditable
            const event = new Event('input', { bubbles: true });
            inputElement.dispatchEvent(event);
        } else {
            inputElement.value = content;
            // Trigger input event for textarea
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Try to find and click the send button
        const sendButtonSelectors = [
            'button[data-testid="send-button"]',
            'button[aria-label*="Send"]',
            'button[type="submit"]',
            'button.send-button',
            'button:has(svg)' // Button containing an SVG icon
        ];

        const sendButton = await waitForElement(sendButtonSelectors);
        if (!sendButton) {
            throw new Error('Could not find send button');
        }

        console.log('[Novel Translator] Found send button:', sendButton);
        sendButton.click();
    } catch (error) {
        console.error('[Novel Translator] Error injecting content:', error);
        throw error;
    }
}

// Function to send message with improved error handling
async function sendMessageWithRetry(messageData, maxRetries = 3, retryDelay = 1000) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Message response timeout'));
                }, 10000);

                chrome.runtime.sendMessage(messageData, response => {
                    clearTimeout(timeoutId);
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    resolve(response || { success: true });
                });
            });

            if (!response.success) {
                throw new Error(response.error || 'Unknown error');
            }

            return response;
        } catch (error) {
            lastError = error;
            console.error(`[Novel Translator] Attempt ${attempt} failed:`, error);
            
            if (attempt < maxRetries) {
                console.log(`[Novel Translator] Retrying in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    throw lastError;
}

// Function to handle translation
async function handleTranslation(content) {
    console.log('[Novel Translator] Starting handleTranslation with content length:', content?.length);
    
    try {
        console.log('[Novel Translator] Starting translation process');
        updateStatus('Bắt đầu dịch...');

        // Inject content into ChatGPT
        await injectContentToChatGPT(content);
        
        // Wait for translation
        updateStatus('Đang đợi ChatGPT trả lời...');
        const translation = await waitForChatGPTResponse(5, 180000);
        
        if (!translation) {
            throw new Error('No translation received');
        }

        if (typeof translation !== 'string') {
            console.error('[Novel Translator] Invalid translation type:', typeof translation);
            throw new Error('Invalid translation type: ' + typeof translation);
        }

        console.log('[Novel Translator] Translation received, length:', translation.length);
        updateStatus('Đã nhận được bản dịch');

        // Function to split translation into chunks
        const chunkString = (str, size) => {
            const chunks = [];
            for (let i = 0; i < str.length; i += size) {
                chunks.push(str.slice(i, i + size));
            }
            return chunks;
        };

        // Handle translation sending
        const MAX_CHUNK_SIZE = 50000; // 50KB chunks

        if (translation.length > MAX_CHUNK_SIZE) {
            const chunks = chunkString(translation, MAX_CHUNK_SIZE);
            const totalChunks = chunks.length;
            
            console.log(`[Novel Translator] Splitting translation into ${totalChunks} chunks`);
            updateStatus(`Đang gửi bản dịch (0/${totalChunks} phần)`);

            // Send chunks
            for (let i = 0; i < chunks.length; i++) {
                updateStatus(`Đang gửi bản dịch (${i + 1}/${totalChunks} phần)`);
                await sendMessageWithRetry({
                    action: 'sendTranslation',
                    translation: chunks[i],
                    chunkIndex: i,
                    totalChunks: totalChunks,
                    isChunked: true
                });
            }

            // Send completion message
            await sendMessageWithRetry({
                action: 'sendTranslation',
                isComplete: true,
                totalChunks: totalChunks,
                isChunked: true
            });
        } else {
            await sendMessageWithRetry({
                action: 'sendTranslation',
                translation: translation,
                isChunked: false
            });
        }

        console.log('[Novel Translator] Translation sent successfully');
        updateStatus('Hoàn thành!', 'success');

        // Clear storage
        await safeStorageSet({ translationContent: null });

        // Close the ChatGPT tab after a short delay
        setTimeout(() => {
            window.close();
        }, 1000);
        
    } catch (error) {
        console.error('[Novel Translator] Error in translation process:', error);
        updateStatus('Lỗi: ' + getLocalizedErrorMessage(error.message), 'error');
        
        // Notify background script about the error
        try {
            await chrome.runtime.sendMessage({
                action: 'translationError',
                error: error.message
            });
        } catch (sendError) {
            console.error('[Novel Translator] Error sending error message:', sendError);
        }
        
        throw error;
    }
}

// Enhanced error message localization
function getLocalizedErrorMessage(message) {
    const errorMessages = {
        'No translation received': 'Không nhận được bản dịch từ ChatGPT',
        'Invalid translation type': 'Định dạng bản dịch không hợp lệ',
        'Message response timeout': 'Hết thời gian chờ phản hồi',
        'Could not find message element': 'Không tìm thấy nội dung tin nhắn',
        'No text elements found in message': 'Không tìm thấy nội dung văn bản trong tin nhắn',
        'ChatGPT encountered an error': 'ChatGPT gặp lỗi khi xử lý',
        'Send button is disabled': 'Nút gửi bị vô hiệu hóa',
        'No novel tab found': 'Không tìm thấy tab tiểu thuyết'
    };
    
    return errorMessages[message] || `Lỗi không xác định: ${message}`;
}

// Initialize variables
let sourceTabId = null;
let initializationAttempt = 0;
const maxAttempts = 3;

// Initialize function
async function initialize() {
    console.log('[Novel Translator] Starting initialization');
    try {
        // Check if we're on the correct GPT page
        if (!isCorrectGPTPage()) {
            console.log('[Novel Translator] Not on the correct GPT page, skipping initialization');
            return;
        }

        if (initializationAttempt >= maxAttempts) {
            console.error('[Novel Translator] Max initialization attempts reached');
            return;
        }

        initializationAttempt++;
        console.log('[Novel Translator] Initialization attempt:', initializationAttempt);
        
        // Check for content to translate
        console.log('[Novel Translator] Checking storage for content...');
        const storageData = await safeStorageGet(['translationContent', 'sourceTabId']);
        console.log('[Novel Translator] Storage content:', storageData);

        if (storageData?.translationContent) {
            console.log('[Novel Translator] Found content to translate, length:', storageData.translationContent.length);
            sourceTabId = storageData.sourceTabId;
            console.log('[Novel Translator] Source tab ID from storage:', sourceTabId);
            await handleTranslation(storageData.translationContent);
        } else {
            console.log('[Novel Translator] No content to translate, waiting for requests');
        }
    } catch (error) {
        console.error('[Novel Translator] Initialization error:', {
            error: error,
            message: error.message,
            stack: error.stack
        });
        initializationAttempt++;
        
        if (initializationAttempt < maxAttempts) {
            const delay = 2000 * Math.pow(2, initializationAttempt);
            console.log(`[Novel Translator] Retrying in ${delay}ms`);
            setTimeout(initialize, delay);
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Also initialize when the URL changes (for single-page app navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('[Novel Translator] URL changed, reinitializing');
        initialize();
    }
}).observe(document, { subtree: true, childList: true });

// Function to safely use chrome storage to get data
async function safeStorageGet(keys) {
    console.log('[Novel Translator] Requesting storage keys:', keys);
    
    try {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('[Novel Translator] Storage error:', chrome.runtime.lastError);
                    const defaultData = {};
                    keys.forEach(key => defaultData[key] = null);
                    resolve(defaultData);
                    return;
                }

                console.log('[Novel Translator] Raw storage result:', result);
                
                // Ensure all requested keys exist with default values
                const data = {};
                keys.forEach(key => {
                    data[key] = result[key] || null;
                });
                
                console.log('[Novel Translator] Processed storage data:', data);
                resolve(data);
            });
        });
    } catch (error) {
        console.error('[Novel Translator] Critical storage error:', error);
        const defaultData = {};
        keys.forEach(key => defaultData[key] = null);
        return defaultData;
    }
}

// Function to safely use chrome storage to set data
async function safeStorageSet(data) {
    console.log('[Novel Translator] Setting storage data:', data);
    
    try {
        return new Promise((resolve) => {
            chrome.storage.local.set(data, () => {
                if (chrome.runtime.lastError) {
                    console.error('[Novel Translator] Storage error:', chrome.runtime.lastError);
                    resolve(false);
                    return;
                }
                resolve(true);
            });
        });
    } catch (error) {
        console.error('[Novel Translator] Critical storage error:', error);
        return false;
    }
}

// Create and manage status indicator
function createStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'novel-translator-status';
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        z-index: 10000;
        font-size: 14px;
        display: none;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;
    document.body.appendChild(indicator);
    return indicator;
}

function updateStatus(message, type = 'info') {
    const indicator = document.getElementById('novel-translator-status') || createStatusIndicator();
    indicator.style.display = 'block';
    indicator.textContent = message;
    
    // Update color based on type
    switch(type) {
        case 'error':
            indicator.style.background = 'rgba(220, 53, 69, 0.9)';
            break;
        case 'success':
            indicator.style.background = 'rgba(40, 167, 69, 0.9)';
            break;
        default:
            indicator.style.background = 'rgba(0, 0, 0, 0.8)';
    }
}

function hideStatus() {
    const indicator = document.getElementById('novel-translator-status');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// Lắng nghe message từ content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Novel Translator] Received message:', message);
    
    if (message.type === 'TRANSLATE_CONTENT') {
        console.log('[Novel Translator] Processing TRANSLATE_CONTENT message');
        console.log('[Novel Translator] Source tab ID:', message.sourceTabId);
        
        sourceTabId = message.sourceTabId;
        
        // Handle the async operation properly
        handleTranslation(message.content)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                sendResponse({ success: false, error: error.message });
            });
            
        return true; // Keep the message channel open for the async response
    }
    return false;
});
