// Functions for interacting with truyencity.com
console.log('[TruyencityTools] Script loading');

async function waitForElement(selector, timeout = 10000) {
    console.log('[TruyencityTools] Waiting for element:', selector);
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('[TruyencityTools] Found element:', selector);
            return element;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('[TruyencityTools] Element not found:', selector);
    return null;
}

async function clickAddChapterButton() {
    console.log('[TruyencityTools] Finding "Thêm chương" button');
    
    // Try different methods to find the button
    const methods = [
        // Method 1: By text content
        () => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Thêm chương'),
        
        // Method 2: By position and text
        () => {
            const div = document.querySelector('div.relative');
            return div?.querySelector('button[type="button"]');
        },
        
        // Method 3: By specific classes
        () => document.querySelector('button.bg-primary.text-primary-foreground')
    ];
    
    for (let i = 0; i < methods.length; i++) {
        console.log(`[TruyencityTools] Trying method ${i + 1}`);
        const button = methods[i]();
        if (button && button.textContent.includes('Thêm chương')) {
            console.log('[TruyencityTools] Found and clicking "Thêm chương" button');
            button.click();
            return true;
        }
    }
    
    // Log all buttons for debugging
    const buttons = document.querySelectorAll('button');
    console.log('[TruyencityTools] All buttons:', Array.from(buttons).map(b => ({
        text: b.textContent,
        classes: b.className,
        type: b.type,
        parent: b.parentElement?.className
    })));
    
    console.log('[TruyencityTools] Could not find "Thêm chương" button');
    return false;
}

async function fillChapterTitle(title) {
    console.log('[TruyencityTools] Waiting for dialog to appear');
    // Wait for dialog to appear
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const dialog = await waitForElement('div[role="dialog"]');
    if (!dialog) {
        console.log('[TruyencityTools] Dialog not found');
        return false;
    }

    // Find input by label
    const label = dialog.querySelector('label[for="name"]');
    if (!label) {
        console.log('[TruyencityTools] Label not found');
        return false;
    }

    // Get input by id matching label's "for" attribute
    const titleInput = dialog.querySelector('#name');
    if (!titleInput) {
        // Try other methods to find input
        const inputs = dialog.querySelectorAll('input');
        console.log('[TruyencityTools] All inputs:', Array.from(inputs).map(i => ({
            type: i.type,
            id: i.id,
            name: i.name,
            placeholder: i.placeholder
        })));
        console.log('[TruyencityTools] Title input not found');
        return false;
    }

    console.log('[TruyencityTools] Found title input, filling:', title);
    titleInput.value = title;
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Find submit button by text
    const buttons = dialog.querySelectorAll('button');
    const submitButton = Array.from(buttons).find(b => 
        b.textContent.includes('Thêm') || 
        b.textContent.includes('OK') ||
        b.textContent.includes('Lưu')
    );

    if (!submitButton) {
        console.log('[TruyencityTools] Submit button not found. All buttons:', 
            Array.from(buttons).map(b => b.textContent));
        return false;
    }

    console.log('[TruyencityTools] Clicking submit button:', submitButton.textContent);
    submitButton.click();

    // Wait for dialog to close and table to update
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find and click edit button
    console.log('[TruyencityTools] Looking for edit button');
    const editResult = await findAndClickEditButton(title);
    if (!editResult) {
        console.log('[TruyencityTools] Failed to click edit button');
        return false;
    }

    return true;
}

async function fillChapterContent(content) {
    console.log('[TruyencityTools] Finding right panel textarea');
    
    // Wait for panels to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find all textareas
    const textareas = document.querySelectorAll('textarea');
    console.log('[TruyencityTools] Found', textareas.length, 'textareas');
    
    // The right textarea is the one in the right panel
    let targetTextarea = null;
    
    // Try different methods to find the right textarea
    for (const textarea of textareas) {
        // Check if this textarea is in the right panel
        const isInRightPanel = textarea.closest('[data-panel-id]:last-child') !== null;
        
        // Skip textareas in the left panel
        if (!isInRightPanel) {
            continue;
        }
        
        targetTextarea = textarea;
        break;
    }

    if (!targetTextarea) {
        console.log('[TruyencityTools] Right panel textarea not found');
        return false;
    }

    console.log('[TruyencityTools] Found textarea, filling content');
    targetTextarea.value = content;
    targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    return true;
}

async function clickPublishButton() {
    console.log('[TruyencityTools] Finding publish button');
    
    // Find button by text content
    const buttons = document.querySelectorAll('button');
    const publishButton = Array.from(buttons).find(b => b.textContent.trim() === 'Đăng truyện');
    
    if (!publishButton) {
        console.log('[TruyencityTools] Publish button not found');
        return false;
    }

    console.log('[TruyencityTools] Clicking publish button');
    publishButton.click();
    
    // Wait for publish to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
}

async function clickBackToStoryButton() {
    console.log('[TruyencityTools] Finding back to story button');
    
    // Find button by text content and arrow-left icon
    const buttons = document.querySelectorAll('button');
    const backButton = Array.from(buttons).find(b => 
        b.textContent.includes('Thông tin truyện') && 
        b.querySelector('svg.lucide-arrow-left')
    );
    
    if (!backButton) {
        console.log('[TruyencityTools] Back button not found');
        return false;
    }

    console.log('[TruyencityTools] Clicking back button');
    backButton.click();
    return true;
}

async function findAndClickEditButton(title) {
    console.log('[TruyencityTools] Finding edit button for chapter:', title);
    
    // Find all rows in the table
    const rows = document.querySelectorAll('table tbody tr');
    
    for (const row of rows) {
        // Find title input in this row
        const titleInput = row.querySelector('input[name="title"]');
        if (!titleInput || titleInput.value !== title) {
            continue;
        }
        
        // Find edit button (link with pen-line icon)
        const editLink = row.querySelector('a.inline-flex svg.lucide-pen-line')?.closest('a');
        if (!editLink) {
            console.log('[TruyencityTools] Edit button not found for chapter:', title);
            continue;
        }

        console.log('[TruyencityTools] Found edit button, clicking...');
        editLink.click();
        return true;
    }

    console.log('[TruyencityTools] Could not find row with title:', title);
    return false;
}

async function clickApproveButton() {
    console.log('[TruyencityTools] Looking for approve button');
    
    // Wait for table to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Find button by its SVG and text content
    const buttons = Array.from(document.querySelectorAll('button'));
    const approveButton = buttons.find(button => {
        const hasCircleIcon = button.querySelector('svg.lucide-circle');
        const hasApproveText = button.textContent.includes('Phê duyệt');
        return hasCircleIcon && hasApproveText;
    });

    if (!approveButton) {
        console.log('[TruyencityTools] Approve button not found');
        return false;
    }

    console.log('[TruyencityTools] Found approve button, clicking');
    approveButton.click();
    
    // Wait for action to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
}

async function postChapterToTruyencity(data) {
    console.log('[TruyencityTools] Starting post process with data:', data);
    const { title, content } = data;
    
    if (!title || !content) {
        console.error('[TruyencityTools] Missing title or content:', { title, content });
        return false;
    }

    // Click "Thêm chương" button
    const addButtonClicked = await clickAddChapterButton();
    if (!addButtonClicked) {
        console.error('[TruyencityTools] Failed to click add chapter button');
        return false;
    }

    // Fill chapter title
    const titleFilled = await fillChapterTitle(title);
    if (!titleFilled) {
        console.error('[TruyencityTools] Failed to fill chapter title');
        return false;
    }

    // Fill chapter content
    const contentFilled = await fillChapterContent(content);
    if (!contentFilled) {
        console.error('[TruyencityTools] Failed to fill chapter content');
        return false;
    }

    // Click publish button
    const publishClicked = await clickPublishButton();
    if (!publishClicked) {
        console.error('[TruyencityTools] Failed to click publish button');
        return false;
    }

    // Click back to story button
    const backClicked = await clickBackToStoryButton();
    if (!backClicked) {
        console.error('[TruyencityTools] Failed to click back button');
        return false;
    }

    // Find and click approve button
    const approveClicked = await clickApproveButton();
    if (!approveClicked) {
        console.error('[TruyencityTools] Failed to click approve button');
        return false;
    }

    console.log('[TruyencityTools] Post process completed successfully');
    
    // Send success message to background script to handle tab operations
    chrome.runtime.sendMessage({
        action: 'truyencityPostComplete',
        success: true
    });
    
    return true;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log('[TruyencityTools] Received message:', message);
    
    if (message.action === 'postChapter') {
        try {
            const result = await postChapterToTruyencity(message.data);
            sendResponse({ success: result });
        } catch (error) {
            console.error('[TruyencityTools] Error posting chapter:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // Keep the message channel open for async response
    }
    else if (message.action === 'clickAddChapter') {
        const result = await clickAddChapterButton();
        sendResponse({ success: result });
    }
    else if (message.action === 'fillChapterTitle') {
        const result = await fillChapterTitle(message.title);
        sendResponse({ success: result });
    }
    else if (message.action === 'clickEditButton') {
        const result = await findAndClickEditButton(message.title);
        sendResponse({ success: result });
    }
    
    return true; // Keep the message channel open for async response
});

console.log('[TruyencityTools] Script loaded');
