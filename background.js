// Logging utility
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logMessage = {
        timestamp,
        level,
        message,
        data
    };
    console.log(`[Novel Translator][${level.toUpperCase()}] ${message}`, data);
}

console.log('BACKGROUND SCRIPT STARTING - IMMEDIATE LOG');

// Constants
const CHATGPT_URL = 'https://chatgpt.com/g/g-6749b358a57c8191a95344323c84c1e1-dich-truyen-tieng-trung-do-thi';
const DEBUG = true;

// Enhanced logging function
function log(type, message, data = null) {
    if (!DEBUG) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[Novel Translator Background][${timestamp}] ${message}`;
    
    switch(type) {
        case 'error':
            console.error(logMessage, data ? data : '');
            break;
        case 'warn':
            console.warn(logMessage, data ? data : '');
            break;
        case 'info':
        default:
            console.log(logMessage, data ? data : '');
    }
}

log('info', 'Background script starting');

// Test chrome API availability
if (chrome && chrome.runtime) {
    log('info', 'Chrome API is available');
} else {
    log('error', 'Chrome API is not available');
}

// Thêm biến để theo dõi tab IDs và pending messages
let novelTabId = null;
let chatGPTTabId = null;
let pendingMessages = new Map();
let translationChunks = new Map(); // Store chunks for reassembly

// Immediate initialization logging
log('info', 'Setting up background script variables');

// Function to load configuration
async function loadConfig() {
    try {
        const response = await fetch(chrome.runtime.getURL('config.json'));
        const config = await response.json();
        
        // Store config in Chrome storage
        await new Promise((resolve, reject) => {
            chrome.storage.local.set(config, () => {
                if (chrome.runtime.lastError) {
                    log('error', 'Error saving config:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    log('info', 'Config loaded successfully:', config);
                    resolve();
                }
            });
        });
    } catch (error) {
        log('error', 'Error loading config:', error);
    }
}

// Test chrome.runtime.onInstalled
chrome.runtime.onInstalled.addListener((details) => {
    log('info', 'Extension installed/updated:', details);
    loadConfig();
});

log('info', 'Background script starting');

// Helper function to clean up pending messages and chunks
function cleanupPendingMessages() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes timeout

    log('info', 'Starting cleanup of pending messages');
    
    let cleanedCount = 0;
    for (const [id, data] of pendingMessages.entries()) {
        if (now - data.timestamp > timeout) {
            pendingMessages.delete(id);
            cleanedCount++;
            log('info', `Cleaned up stale message for tab ${id}`, data);
        }
    }
    
    let chunksCleanedCount = 0;
    for (const [id, data] of translationChunks.entries()) {
        if (now - data.timestamp > timeout) {
            translationChunks.delete(id);
            chunksCleanedCount++;
            log('info', `Cleaned up stale chunks for tab ${id}`, data);
        }
    }
    
    log('info', 'Cleanup completed', {
        messagesRemoved: cleanedCount,
        chunksRemoved: chunksCleanedCount,
        remainingMessages: pendingMessages.size,
        remainingChunks: translationChunks.size
    });
}

// Register the service worker
self.addEventListener('activate', (event) => {
    log('info', 'Service worker activated');
});

log('info', 'Background script loaded');

// Function to find novel tab with improved matching
async function findNovelTab() {
    log('info', 'Finding novel tab');
    try {
        let allTabs = [];
        
        // Query for localhost tabs
        const localTabs = await new Promise(resolve => {
            chrome.tabs.query({
                url: ['http://localhost/*', 'https://localhost/*']
            }, tabs => {
                resolve(tabs || []);
            });
        });
        allTabs.push(...localTabs);
        
        // Query for file:// tabs
        const fileTabs = await new Promise(resolve => {
            chrome.tabs.query({
                url: ['file:///*']
            }, tabs => {
                resolve(tabs || []);
            });
        });
        allTabs.push(...fileTabs);

        log('info', 'Found tabs:', allTabs);

        if (!allTabs || allTabs.length === 0) {
            log('error', 'No tabs found');
            throw new Error('No novel tab found - Please make sure you have the novel page open');
        }

        // First try to find a tab with novel-related keywords
        const novelTab = allTabs.find(tab => {
            if (!tab || !tab.url) return false;
            const url = tab.url.toLowerCase();
            const title = (tab.title || '').toLowerCase();
            return url.includes('book') || 
                   url.includes('chapter') || 
                   url.includes('novel') ||
                   title.includes('chapter') ||
                   title.includes('novel');
        });

        if (novelTab) {
            novelTabId = novelTab.id;
            log('info', 'Found novel tab:', novelTabId);
            return novelTabId;
        }

        // If no novel-specific tab found, use the first available tab
        if (allTabs.length > 0 && allTabs[0].id) {
            novelTabId = allTabs[0].id;
            log('info', 'Using first available tab:', novelTabId);
            return novelTabId;
        }

        throw new Error('No suitable tab found - Please make sure you have the novel page open');
    } catch (error) {
        log('error', 'Error finding novel tab:', error);
        throw error;
    }
}

// Listen for when a tab is updated
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    try {
        log('info', 'Tab updated', {
            tabId,
            url: tab.url,
            changeInfo,
            currentNovelTab: novelTabId,
            currentChatGPTTab: chatGPTTabId
        });

        if (changeInfo.status === 'complete' && tab.url) {
            log('info', 'Tab load complete', { tabId, url: tab.url });
            
            if (tab.url.includes('localhost') && 
                (tab.url.includes('/book/') || tab.url.includes('/chapter/'))) {
                log('info', 'Found novel tab', { tabId, previousNovelTab: novelTabId });
                novelTabId = tabId;
            } else if (isCorrectChatGPTTab(tab.url)) {
                log('info', 'Found correct ChatGPT tab', { tabId, previousChatGPTTab: chatGPTTabId });
                chatGPTTabId = tabId;
                
                // Get current tab to verify permissions
                const currentTab = await chrome.tabs.get(tabId);
                log('info', 'Current tab details', currentTab);

                // Inject the content script
                log('info', 'Attempting to inject script', { tabId });
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['chatgpt-content.js']
                    });
                    log('info', 'Successfully injected script', { tabId });
                } catch (err) {
                    log('error', 'Script injection failed', {
                        tabId,
                        error: {
                            message: err.message,
                            stack: err.stack
                        }
                    });
                }
            }
        }
    } catch (error) {
        log('error', 'Error in onUpdated listener', {
            error: {
                message: error.message,
                stack: error.stack
            },
            tabId,
            changeInfo
        });
    }
});

// Function to check if a tab is the correct ChatGPT tab
function isCorrectChatGPTTab(url) {
    const isCorrect = url && url.includes(CHATGPT_URL);
    log('info', 'Checking ChatGPT URL', { url, isCorrect });
    return isCorrect;
}

// Listen for tab removals to clean up IDs
chrome.tabs.onRemoved.addListener((tabId) => {
    log('info', 'Tab removed', { tabId, wasNovelTab: tabId === novelTabId, wasChatGPTTab: tabId === chatGPTTabId });
    
    if (tabId === novelTabId) {
        log('info', 'Novel tab was closed', { tabId });
        novelTabId = null;
    } else if (tabId === chatGPTTabId) {
        log('info', 'ChatGPT tab was closed', { tabId });
        chatGPTTabId = null;
    }
});

// Function to send translation to novel tab
async function sendTranslationToTab(tabId, translation, messageId) {
    log('info', 'Sending translation to tab', {
        tabId,
        translationLength: translation?.length,
        messageId
    });

    if (!translation) {
        throw new Error('Empty translation');
    }

    if (typeof translation !== 'string') {
        throw new Error('Invalid translation type: ' + typeof translation);
    }

    try {
        const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, {
                type: 'TRANSLATION_COMPLETE',
                translation: translation,
                messageId: messageId
            }, response => {
                if (chrome.runtime.lastError) {
                    log('error', 'Error sending to tab', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve(response || { success: true });
            });
        });
        return true;
    } catch (error) {
        log('error', 'Error sending translation', error);
        throw error;
    }
}

// Xử lý messages từ content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('info', 'Received message in background script', { message, sender });

    try {
        if (message.action === 'truyencityPostComplete') {
            log('info', 'Post completed, sending completion message to novel tab');
            // Send completion message to novel tab
            if (novelTabId) {
                chrome.tabs.sendMessage(novelTabId, {
                    action: 'postCompleted',
                    success: true
                }, () => {
                    // After sending message, close the Truyencity tab
                    chrome.tabs.remove(sender.tab.id);
                });
            }
            return true;
        }

        if (message.action === 'postToTruyencity') {
            log('info', 'Posting to Truyencity', { url: message.url });
            
            chrome.tabs.create({ url: message.url }, async (tab) => {
                try {
                    log('info', 'Tab created, waiting for load', { tabId: tab.id });
                    
                    // Wait for tab to be completely loaded
                    await new Promise((resolve) => {
                        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                            if (tabId === tab.id && info.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(listener);
                                resolve();
                            }
                        });
                    });

                    log('info', 'Tab loaded, injecting script', { tabId: tab.id });

                    // Inject our Truyencity tools script
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['truyencity.js']
                    });

                    // Wait a bit for the script to initialize
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    log('info', 'Script injected, posting chapter', { tabId: tab.id });

                    // Execute the posting function
                    const result = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: async (title, content) => {
                            try {
                                // Make sure truyencityTools is available
                                if (!window.truyencityTools) {
                                    throw new Error('truyencityTools not found');
                                }
                                
                                console.log('truyencityTools:', window.truyencityTools);
                                const result = await window.truyencityTools.postChapterToTruyencity(title, content);
                                console.log('Post result:', result);
                                return result;
                            } catch (error) {
                                console.error('Error in executeScript:', error);
                                return { success: false, error: error.message };
                            }
                        },
                        args: [message.title, message.content]
                    });

                    log('info', 'Chapter posted', { result: result[0]?.result });
                    
                    if (result && result[0]?.result) {
                        sendResponse(result[0].result);
                    } else {
                        sendResponse({ success: false, error: 'No result from script execution' });
                    }
                } catch (error) {
                    log('error', 'Error posting to Truyencity', {
                        error: {
                            message: error.message,
                            stack: error.stack
                        }
                    });
                    sendResponse({ success: false, error: error.message });
                }
            });
            return true; // Keep the message channel open for async response
        }

        if (message.action === 'openTruyencityTab') {
            log('info', 'Creating Truyencity tab', { url: message.url });
            
            chrome.tabs.create({ url: message.url }, async (tab) => {
                try {
                    log('info', 'Tab created, waiting for load', { tabId: tab.id });
                    
                    // Wait for tab to be completely loaded
                    await new Promise((resolve) => {
                        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                            if (tabId === tab.id && info.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(listener);
                                resolve();
                            }
                        });
                    });

                    log('info', 'Tab loaded, injecting script', { tabId: tab.id });

                    // Inject our Truyencity tools script
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['truyencity.js']
                    });

                    log('info', 'Script injected successfully', { tabId: tab.id });
                    
                    sendResponse({ success: true, tabId: tab.id });
                } catch (error) {
                    log('error', 'Error in tab creation/injection', {
                        error: {
                            message: error.message,
                            stack: error.stack
                        }
                    });
                    sendResponse({ success: false, error: error.message });
                }
            });
            return true; // Keep the message channel open for async response
        }

        if (message.action === 'openTruyencity') {
            console.log('[Background] Opening Truyencity:', message.url);
            chrome.tabs.create({ url: message.url }, function(tab) {
                console.log('[Background] Truyencity tab created:', tab.id);
            });
            sendResponse({ success: true });
            return true;
        }

        if (message.action === 'openTruyencityAndPost') {
            console.log('[Background] Opening Truyencity for posting:', message.url);
            
            // Create tab and wait for it to be ready
            chrome.tabs.create({ url: message.url }, async (tab) => {
                console.log('[Background] Truyencity tab created:', tab.id);
                
                // Wait for tab to be complete
                try {
                    await new Promise((resolve) => {
                        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                            if (tabId === tab.id && info.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(listener);
                                resolve();
                            }
                        });
                    });
                    
                    // Send message to the new tab
                    console.log('[Background] Tab ready, sending post data');
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'postChapter',
                        data: message.data
                    });
                    
                    sendResponse({ success: true });
                } catch (error) {
                    console.error('[Background] Error:', error);
                    sendResponse({ success: false, error: error.message });
                }
            });
            
            return true; // Keep message channel open
        }

        if (message.action === 'sendTranslation') {
            const messageId = Date.now().toString();
            
            // Handle chunked translation
            if (message.isChunked) {
                if (message.isComplete) {
                    // All chunks received, try to reassemble and send
                    const chunks = translationChunks.get(sender.tab.id);
                    if (!chunks || chunks.receivedChunks !== message.totalChunks) {
                        log('error', 'Missing chunks or invalid count');
                        sendResponse({ success: false, error: 'Invalid chunk state' });
                        return true;
                    }

                    // Reassemble translation
                    const fullTranslation = chunks.chunks.join('');
                    log('info', `Reassembled translation, length: ${fullTranslation.length}`);

                    // Send complete translation
                    (async () => {
                        try {
                            const tabId = await findNovelTab();
                            await sendTranslationToTab(tabId, fullTranslation, messageId);
                            translationChunks.delete(sender.tab.id); // Cleanup chunks
                            sendResponse({ success: true });
                        } catch (error) {
                            log('error', 'Error sending assembled translation', error);
                            sendResponse({ success: false, error: error.message });
                        }
                    })();
                    
                    return true;
                }

                // Store chunk
                if (!translationChunks.has(sender.tab.id)) {
                    translationChunks.set(sender.tab.id, {
                        chunks: new Array(message.totalChunks).fill(''),
                        receivedChunks: 0,
                        timestamp: Date.now()
                    });
                }

                const chunkData = translationChunks.get(sender.tab.id);
                chunkData.chunks[message.chunkIndex] = message.translation;
                chunkData.receivedChunks++;

                log('info', `Received chunk ${message.chunkIndex + 1}/${message.totalChunks}`);
                sendResponse({ success: true });
                return true;
            }

            // Handle single message translation
            if (!message.translation) {
                log('error', 'Received empty translation');
                sendResponse({ success: false, error: 'Empty translation received' });
                return true;
            }

            // Handle single message translation
            (async () => {
                try {
                    const tabId = await findNovelTab();
                    await sendTranslationToTab(tabId, message.translation, messageId);
                    sendResponse({ success: true });
                } catch (error) {
                    log('error', 'Error sending translation', error);
                    sendResponse({ success: false, error: error.message });
                }
            })();

            return true;
        }

        if (message.action === 'translationError') {
            if (novelTabId) {
                chrome.tabs.sendMessage(novelTabId, {
                    type: 'TRANSLATION_ERROR',
                    error: message.error
                }, response => {
                    if (chrome.runtime.lastError) {
                        log('error', 'Error sending error message', chrome.runtime.lastError);
                    }
                });
            }
            return true;
        }

        if (message.action === 'truyencityPostComplete' && message.success) {
            log('info', 'TruyenCity post completed, handling tab operations');
            
            // Get current tab (TruyenCity tab)
            const truyencityTabId = sender.tab.id;
            
            // Find and notify the original tab
            chrome.tabs.query({}, function(tabs) {
                tabs.forEach(tab => {
                    if (tab.id !== truyencityTabId) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'postCompleted',
                            success: true
                        });
                    }
                });
                
                // Close TruyenCity tab
                chrome.tabs.remove(truyencityTabId);
            });
            
            return true;
        }
    } catch (error) {
        log('error', 'Error processing message', {
            error: {
                message: error.message,
                stack: error.stack
            },
            message,
            sender
        });
        sendResponse({ success: false, error: error.message });
    }
});

// Run cleanup periodically
setInterval(cleanupPendingMessages, 60000); // Every minute

log('info', 'Background script initialization complete');
