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
  const chatGPTUrl = 'https://chatgpt.com/g/g-6749b358a57c8191a95344323c84c1e1-dich-truyen-tieng-trung-do-thi';
  
  // Open ChatGPT in a new tab
  const newTab = window.open(chatGPTUrl, '_blank');
  
  // Store content in localStorage to access it in the new tab
  localStorage.setItem('novelContent', content);
}
