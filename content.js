// Constants
const CHATGPT_URL = 'https://chat.openai.com/g/g-6749b358a57c8191a95344323c84c1e1-dich-truyen-tieng-trung-do-thi';

// Function to safely use chrome storage
async function safeStorageSet(data) {
    if (!chrome?.storage?.local) {
        console.error('[Novel Translator] Chrome storage not available');
        throw new Error('Storage API not available');
    }

    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.set(data, () => {
                if (chrome.runtime.lastError) {
                    console.error('[Novel Translator] Storage error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        } catch (error) {
            console.error('[Novel Translator] Storage error:', error);
            reject(error);
        }
    });
}

// Function to safely use chrome storage to get data
async function safeStorageGet(keys) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('[Novel Translator] Storage error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        } catch (error) {
            console.error('[Novel Translator] Storage error:', error);
            reject(error);
        }
    });
}

// Function to extract original content
function extractOriginalContent() {
    // First try to find the content in the original-content div
    const contentDiv = document.querySelector('div.original-content');
    if (!contentDiv) {
        console.log('[Novel Translator] Could not find original content div');
        return null;
    }

    // Get all text nodes within the div, excluding nested elements' text
    const textNodes = Array.from(contentDiv.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE);
    
    // Combine all text content with proper spacing
    const content = textNodes
        .map(node => node.textContent?.trim())
        .filter(text => text) // Remove empty strings
        .join('\n');

    if (!content) {
        console.log('[Novel Translator] No content found in div');
        return null;
    }

    console.log('[Novel Translator] Successfully extracted content');
    return content;
}

// Function to inject content to ChatGPT input
async function injectContentToChatGPT(content) {
    console.log('[Novel Translator] Injecting content to ChatGPT');
    
    try {
        // Find the input textarea
        const textarea = document.querySelector('textarea[data-id="root"]');
        if (!textarea) {
            console.log('[Novel Translator] Could not find ChatGPT input');
            return;
        }

        // Set content and trigger input event
        textarea.value = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        // Find and click send button
        const sendButton = document.querySelector('button[data-testid="send-button"]');
        if (sendButton && !sendButton.disabled) {
            sendButton.click();
            console.log('[Novel Translator] Content sent to ChatGPT');
        }
    } catch (error) {
        console.error('[Novel Translator] Error injecting content:', error);
    }
}

// Function to wait for ChatGPT response
async function waitForResponse() {
    console.log('[Novel Translator] Waiting for ChatGPT response');
    
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            const copyButton = document.querySelector('button[data-testid="copy-button"]');
            if (copyButton) {
                clearInterval(checkInterval);
                
                // Get the response content
                const responseElement = document.querySelector('.markdown.prose');
                if (responseElement) {
                    const response = responseElement.innerText;
                    console.log('[Novel Translator] Got response from ChatGPT');
                    resolve(response);
                } else {
                    console.log('[Novel Translator] Could not find response content');
                    resolve(null);
                }
            }
        }, 1000);

        // Timeout after 2 minutes
        setTimeout(() => {
            clearInterval(checkInterval);
            console.log('[Novel Translator] Response timeout');
            resolve(null);
        }, 120000);
    });
}

// Function to save translation
async function saveTranslation(translation, url) {
    console.log('[Novel Translator] Saving translation');
    
    try {
        const response = await fetch('/api/translation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url,
                translation,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to save translation');
        }
        
        console.log('[Novel Translator] Translation saved successfully');
    } catch (error) {
        console.error('[Novel Translator] Error saving translation:', error);
    }
}

// Function to add translate button
function addTranslateButton() {
    console.log('[Novel Translator] Adding translate button');
    
    // Remove any existing translate button
    const existingButton = document.querySelector('#novel-translate-button');
    if (existingButton) {
        existingButton.remove();
    }

    const button = document.createElement('button');
    button.id = 'novel-translate-button';
    button.textContent = 'Translate with ChatGPT';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px 20px;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: opacity 0.2s;
    `;

    button.addEventListener('mouseover', () => {
        button.style.opacity = '0.9';
    });

    button.addEventListener('mouseout', () => {
        button.style.opacity = '1';
    });

    button.addEventListener('click', async () => {
        const content = extractOriginalContent();
        if (!content) {
            console.log('[Novel Translator] No content found to translate');
            return;
        }

        try {
            // Store content in chrome storage
            await safeStorageSet({
                translationContent: content
            });
            
            console.log('[Novel Translator] Content stored successfully');
            // Open ChatGPT in new tab
            window.open(CHATGPT_URL, '_blank');
        } catch (err) {
            console.error('[Novel Translator] Error handling translation:', err);
        }
    });

    // Try to add button to the page
    const addButtonToPage = () => {
        if (document.body) {
            document.body.appendChild(button);
            console.log('[Novel Translator] Added translate button to page');
            return true;
        }
        return false;
    };

    // If body is not ready, wait for it
    if (!addButtonToPage()) {
        const observer = new MutationObserver((mutations, obs) => {
            if (addButtonToPage()) {
                obs.disconnect();
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }
}

// Function to add Truyencity button
function addTruyencityButton() {
    console.log('[Novel Translator] Adding Truyencity button');
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;

    // Create Truyencity button
    const truyencityButton = document.createElement('button');
    truyencityButton.id = 'truyencity-post-button';
    truyencityButton.textContent = 'Post to Truyencity';
    truyencityButton.style.cssText = `
        padding: 10px 20px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
    `;

    // Hover effect
    truyencityButton.onmouseover = () => {
        truyencityButton.style.backgroundColor = '#45a049';
        truyencityButton.style.transform = 'translateY(-2px)';
    };
    truyencityButton.onmouseout = () => {
        truyencityButton.style.backgroundColor = '#4CAF50';
        truyencityButton.style.transform = 'translateY(0)';
    };

    // Click handler
    truyencityButton.onclick = async () => {
        try {
            console.log('[Novel Translator] Post button clicked');
            // Get title and content from textareas
            const titleTextarea = document.querySelector('textarea[placeholder="Enter chapter title..."]');
            const contentTextarea = document.querySelector('textarea[placeholder="Paste translated content here..."]');

            if (!titleTextarea || !contentTextarea) {
                console.error('[Novel Translator] Could not find translation textareas:', {
                    titleFound: !!titleTextarea,
                    contentFound: !!contentTextarea
                });
                alert('No translation content found. Please translate the chapter first.');
                return;
            }

            const title = titleTextarea.value.trim();
            const content = contentTextarea.value.trim();

            if (!content) {
                alert('No translation content found. Please translate the chapter first.');
                return;
            }

            // Get Truyencity URL from storage
            const config = await safeStorageGet(['truyencityUrl']);
            if (!config.truyencityUrl) {
                alert('Truyencity URL not configured. Please set it in the extension options.');
                return;
            }

            // Store the content and title for use after navigation
            console.log('[Novel Translator] Storing pending post:', { title, contentLength: content.length });
            await safeStorageSet({
                pendingPost: {
                    title,
                    content,
                    timestamp: Date.now()
                }
            });

            // Send message to background to open Truyencity tab
            console.log('[Novel Translator] Opening Truyencity:', config.truyencityUrl);
            const response = await chrome.runtime.sendMessage({
                action: 'openTruyencityAndPost',
                url: config.truyencityUrl,
                data: {
                    title,
                    content
                }
            });
            console.log('[Novel Translator] Background response:', response);

        } catch (error) {
            console.error('[Novel Translator] Error posting to Truyencity:', error);
            alert('Error posting to Truyencity. Please check the console for details.');
        }
    };

    // Remove any existing Truyencity button
    const existingButton = document.querySelector('#truyencity-post-button');
    if (existingButton) {
        existingButton.remove();
    }

    // Add button to container
    buttonContainer.appendChild(truyencityButton);

    // Add container to page
    document.body.appendChild(buttonContainer);
    console.log('[Novel Translator] Truyencity button added');
}

// Function to handle auto input
async function handleAutoInput() {
    const content = await safeStorageGet(['translationContent']);
    if (!content.translationContent) {
        console.error('[Novel Translator] No content found in storage');
        return;
    }

    await injectContentToChatGPT(content.translationContent);
    const translation = await waitForResponse();
    if (translation) {
        // Save translation
        await saveTranslation(translation, content.novelUrl);
    }
}

// Function to initialize based on current page
async function initialize() {
    console.log('[Novel Translator] Initializing on page:', window.location.href);
    
    if (window.location.href.includes('localhost:3000/chapter/')) {
        // Add both buttons on localhost chapter page
        addTranslateButton();
        addTruyencityButton();
    } else if (window.location.href.includes('truyencity.com/admin/stories') && window.location.href.includes('/chapters/')) {
        // On Truyencity edit page, check for pending content
        console.log('[Novel Translator] On chapter edit page, checking for pending content');
        const { pendingContent } = await safeStorageGet(['pendingContent']);
        if (pendingContent) {
            console.log('[Novel Translator] Found pending content, filling chapter');
            // Clear the pending content first to avoid loops
            await safeStorageSet({ pendingContent: null });
            
            // Wait for truyencityTools to be available
            let attempts = 0;
            const maxAttempts = 10;
            while (!window.truyencityTools && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }
            
            if (window.truyencityTools) {
                console.log('[Novel Translator] truyencityTools found, filling content');
                const result = await window.truyencityTools.fillChapterContent(pendingContent);
                console.log('[Novel Translator] Fill chapter result:', result);
            } else {
                console.error('[Novel Translator] truyencityTools not found after waiting');
            }
        }
    }
}

// Function to handle translation
async function handleTranslation(content) {
    const translation = await sendContentToChatGPT(content);
    if (translation) {
        await window.truyencityTools.postChapterToTruyencity(translation.title, translation.content);
    }
}

// Function to send content to ChatGPT
async function sendContentToChatGPT(content) {
    try {
        // Store content and sourceTabId into storage
        await safeStorageSet({
            translationContent: content,
            sourceTabId: await chrome.tabs.getCurrent().id
        });

        // Open ChatGPT in new tab
        const chatGPTUrl = 'https://chat.openai.com/g/g-6749b358a57c8191a95344323c84c1e1-dich-truyen-tieng-trung-do-thi';
        await chrome.tabs.create({ url: chatGPTUrl });

    } catch (error) {
        console.error('[Novel Translator] Error sending content:', error);
        throw error;
    }
}

// Function to inject translation
function injectTranslation(translation) {
    console.log('[Novel Translator] Attempting to inject translation');

    // Parse title and content
    let title = '';
    let content = translation;

    // Tách dòng đầu tiên để lấy title
    const lines = translation.split('\n');
    if (lines.length > 0) {
        const firstLine = lines[0];
        // Tìm pattern "Chương x:" trong dòng đầu
        const titleMatch = firstLine.match(/Chương\s+\d+\s*:(.*)/i);
        if (titleMatch) {
            title = titleMatch[1].trim(); // Lấy phần text sau "Chương x:"
            content = lines.slice(1).join('\n').trim(); // Phần còn lại là content
        } else {
            // If no title pattern is found, use the first line as the title
            title = firstLine.trim();
            content = lines.slice(1).join('\n').trim();
        }
    }

    // Tìm và cập nhật title textarea
    const titleTextarea = document.querySelector('textarea[placeholder="Enter chapter title..."]');
    if (titleTextarea) {
        console.log('[Novel Translator] Found title textarea, updating value');
        titleTextarea.value = title;
        
        // Trigger events
        const inputEvent = new Event('input', { bubbles: true });
        titleTextarea.dispatchEvent(inputEvent);
        
        const changeEvent = new Event('change', { bubbles: true });
        titleTextarea.dispatchEvent(changeEvent);
    }

    // Tìm và cập nhật content textarea
    const contentTextarea = document.querySelector('textarea[placeholder="Paste translated content here..."]');
    if (contentTextarea) {
        console.log('[Novel Translator] Found content textarea, updating value');
        
        contentTextarea.value = content
            .replace(/\\n/g, '\n')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();
        
        // Trigger events
        const inputEvent = new Event('input', { bubbles: true });
        contentTextarea.dispatchEvent(inputEvent);
        
        const changeEvent = new Event('change', { bubbles: true });
        contentTextarea.dispatchEvent(changeEvent);
        
        // Get current URL and update JSON file
        const currentUrl = window.location.href;
        updateChapterStatus(currentUrl);
        
        console.log('[Novel Translator] Translation injected and events triggered');
        return;
    }

    console.error('[Novel Translator] Could not find translation textareas');
}

// Function to update chapter status in JSON file
async function updateChapterStatus(url) {
    try {
        // If URL is from frontend, extract the actual book URL
        let bookUrl = url;
        if (url.startsWith('http://localhost:3000/chapter/')) {
            bookUrl = decodeURIComponent(url.replace('http://localhost:3000/chapter/', ''));
        }
        
        // Extract bookId and chapterId from URL
        const urlObj = new URL(bookUrl);
        console.log('[Novel Translator] Original URL:', url);
        console.log('[Novel Translator] Decoded book URL:', bookUrl);
        console.log('[Novel Translator] URL pathname:', urlObj.pathname);
        
        // Extract book ID - should be numeric ID after /book/
        const bookIdMatch = urlObj.pathname.match(/\/book\/(\d+)/);
        const bookId = bookIdMatch ? bookIdMatch[1] : null;
        
        // Extract chapter number - should be numeric ID before .html
        const chapterMatch = urlObj.pathname.match(/\/(\d+)\.html$/);
        const chapterNumber = chapterMatch ? chapterMatch[1] : null;
        const chapterId = chapterNumber ? `chapter-${chapterNumber}` : null;

        console.log('[Novel Translator] Extracted IDs:', { bookId, chapterNumber, chapterId });

        if (!bookId || !chapterId) {
            console.error('[Novel Translator] Invalid URL format:', bookUrl);
            return;
        }

        console.log('[Novel Translator] Updating chapter status:', { bookId, chapterId });
        const apiUrl = `http://localhost:3000/api/chapters/${bookId}--${chapterId}/status`;
        console.log('[Novel Translator] API URL:', apiUrl);

        // Send request to update chapter status
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ translated: true })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update chapter status: ${errorText}`);
        }

        console.log('[Novel Translator] Successfully updated chapter status');
    } catch (error) {
        console.error('[Novel Translator] Error updating chapter status:', error);
    }
}

// Function to find and click Mark Done button
async function clickMarkDoneButton() {
    const markDoneButton = Array.from(document.querySelectorAll('button')).find(button => 
        button.textContent.includes('Mark Done')
    );
    if (markDoneButton) {
        markDoneButton.click();
        console.log('[Novel Translator] Clicked Mark Done button');
        return true;
    }
    console.log('[Novel Translator] Mark Done button not found');
    return false;
}

// Listen for messages from the webpage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Novel Translator] Received message:', message);

    if (message.type === 'TRANSLATION_COMPLETE') {
        if (!message.translation) {
            console.error('[Novel Translator] Received empty translation');
            sendResponse({ success: false, error: 'Empty translation received' });
            return true;
        }

        try {
            console.log('[Novel Translator] Injecting translation of length:', message.translation.length);
            injectTranslation(message.translation);
            sendResponse({ success: true });
        } catch (error) {
            console.error('[Novel Translator] Error injecting translation:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    if (message.type === 'TRANSLATION_ERROR') {
        console.error('[Novel Translator] Translation error:', message.error);
        // Handle error UI here if needed
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'SET_TRANSLATION_CONTENT') {
        console.log('[Novel Translator] Received content to translate:', message);
        try {
            // Store content in chrome storage
            safeStorageSet({ translationContent: message.content })
                .then(() => {
                    console.log('[Novel Translator] Content stored successfully');
                    // Open ChatGPT in a new tab
                    chrome.runtime.sendMessage({
                        action: 'openChatGPT',
                        content: message.content
                    });
                })
                .catch(error => {
                    console.error('[Novel Translator] Error storing content:', error);
                });

            sendResponse({ success: true });
        } catch (error) {
            console.error('[Novel Translator] Error handling translation content:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    if (message.action === 'postCompleted' && message.success) {
        console.log('[Novel Translator] Post completed successfully, clicking Mark Done button');
        clickMarkDoneButton().then(result => {
            console.log('[Novel Translator] Mark Done button click result:', result);
        });
        return true;
    }

    return false;
});

// Listen for translation from ChatGPT tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Novel Translator] Received message:', message);

    if (message.type === 'TRANSLATION_COMPLETE') {
        console.log('[Novel Translator] Received translation, length:', message.translation.length);
        console.log('[Novel Translator] Translation preview:', message.translation.substring(0, 100) + '...');
        
        // Thử inject vài lần trong trường hợp React chưa render xong
        let attempts = 0;
        const maxAttempts = 5;
        
        const tryInject = () => {
            if (attempts >= maxAttempts) {
                console.error('[Novel Translator] Failed to inject translation after', maxAttempts, 'attempts');
                return;
            }
            
            attempts++;
            console.log('[Novel Translator] Injection attempt', attempts);
            
            injectTranslation(message.translation);
            
            // Nếu không tìm thấy textarea, thử lại sau 500ms
            if (!document.querySelector('textarea[placeholder="Paste translated content here..."]')) {
                setTimeout(tryInject, 500);
            }
        };
        
        tryInject();
        sendResponse({ success: true });
    }

    if (message.type === 'TRANSLATION_ERROR') {
        console.error('[Novel Translator] Translation error:', message.error);
        alert(`Translation error: ${message.error}`);
    }
});

// Start the extension
console.log('[Novel Translator] Content script starting');
initialize();
