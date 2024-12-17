document.getElementById('translateButton').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Inject the content script
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: getAndTranslateContent
  });
});

function getAndTranslateContent() {
  const content = document.querySelector('.chapter-content')?.textContent || '';
  const chatGPTUrl = 'https://chatgpt.com/g/g-676165fe70708191a7d1c18fa897b935-dich-truyen-do-thi';
  
  // Open ChatGPT in a new tab
  const newTab = window.open(chatGPTUrl, '_blank');
  
  // Store content in localStorage to access it in the new tab
  localStorage.setItem('novelContent', content);
}
