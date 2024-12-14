# Novel Translation Chrome Extension

This Chrome extension adds a "Translate by GPT" button to novel chapter pages that helps translate content using ChatGPT.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `chrome-extension` folder

## Configuration

1. The extension uses a custom ChatGPT model for translation (URL configured in `config.json`)
2. Make sure you have access to ChatGPT in your browser

## Project Structure

- `manifest.json`: Extension configuration and permissions
- `background.js`: Service worker handling communication between tabs and translation management
- `content.js`: Main content script for webpage interaction and UI elements
- `chatgpt-content.js`: Handles interaction with ChatGPT interface
- `truyencity.js`: Specific functionality for Truyencity website
- `popup.html/js`: Extension popup interface
- `config.json`: Extension configuration settings
- `utils/`: Utility functions and helpers
- `native_host/`: Native messaging host components

## Features

- Adds a floating "Translate by GPT" button to chapter pages
- Automatically extracts novel content from web pages
- Opens ChatGPT in a new tab with pre-filled content
- Manages the translation process through ChatGPT integration
- Stores translated content for future reference
- Tracks chapter translation status
- Provides a notification system for translation updates
- Supports chunked translation for long chapters
- Auto-saves translations to prevent data loss

## Permissions

The extension requires the following permissions:
- Storage: For saving translations and settings
- Tabs: For managing translation windows
- Scripting: For content manipulation
- ActiveTab: For current page interaction

## Troubleshooting

1. If the translation button doesn't appear:
   - Refresh the page
   - Make sure you're on a supported novel website

2. If translations fail:
   - Check your ChatGPT access
   - Ensure you're logged into ChatGPT
   - Try refreshing both the novel page and ChatGPT

3. For connection issues:
   - Check your internet connection
   - Reload the extension from Chrome's extension manager
