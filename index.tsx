/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Chat } from '@google/genai';
import { marked } from 'marked';

// The API key is now expected to be in environment variables.

// DOM Elements
const chatHistory = document.getElementById('chat-history') as HTMLElement;
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendButton = chatForm.querySelector('button') as HTMLButtonElement;

// App state
let chat: Chat;
let isFirstMessage = true;

// System prompt from user request
const systemInstruction = `
まず、こちらからユーザーの名前と不安や悩みについて質問すること。
もし、名前を言えない場合は、聞き返さずに不安や悩みだけ聞くこと。
また、ユーザーが具体的なことについて話したくない場合は、無理に聞き出さないこと。

ユーザーから悩みや不安について相談を受けたら、まずその内容を解消するためのアドバイスを、関連する項目ごとに専門家の意見を交えながら順位付けて回答すること。
それだけでなく、参考になりそうな文献やWebサイトも紹介すること。
カウンセリングに関連のない質問事項は回答しないこと。

このチャットでのユーザーの名前、相談内容、およびAIによるアドバイスは、モデルの学習には一切利用されません。Geminiアプリのアクティビティはオフになっています。
`;

/**
 * Sends a message to the chat and streams the response.
 * @param message The message to send.
 */
async function getAndStreamResponse(message: string) {
    const botMessageElement = displayMessage('bot', '', true);
    setFormDisabled(true);
    try {
        if (!chat) {
            // This case is handled by initializeChat, but as a safeguard:
            throw new Error("Chat not initialized. API key might be missing.");
        }
        const responseStream = await chat.sendMessageStream({ message });
        let fullResponse = '';
        for await (const chunk of responseStream) {
            fullResponse += chunk.text;
            // Using marked to render markdown for lists, links, etc.
            botMessageElement.innerHTML = await marked.parse(fullResponse);
        }
        botMessageElement.classList.remove('loading');
    } catch (error) {
        console.error(error);
        // Check for specific API key error from Google AI SDK
        const errorMessage = (error instanceof Error && error.message.includes('API key not valid'))
            ? 'APIキーが無効です。GitHub Secretsに正しいAPIキーが設定されているか確認してください。'
            : 'エラーが発生しました。もう一度お試しください。';
        botMessageElement.innerHTML = errorMessage;
        botMessageElement.classList.remove('loading');
    } finally {
        setFormDisabled(false);
        chatInput.focus();
    }
}

/**
 * Initializes the chat application.
 */
async function initializeChat() {
    if (!process.env.API_KEY) {
        displayMessage('bot', 'APIキーが設定されていません。このアプリケーションをデプロイするリポジトリのGitHub Secretsに `API_KEY` を設定してください。');
        setFormDisabled(true);
        return;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        chat = ai.chats.create({
            model: 'gemini-2.5-flash-preview-04-17',
            config: {
                systemInstruction: systemInstruction,
            },
        });

        if (isFirstMessage) {
            isFirstMessage = false;
            // The system prompt instructs the bot to ask the first question.
            // We send an initial message to kick off the conversation.
            await getAndStreamResponse("こんにちは、カウンセリングを開始します。");
        }
    } catch (error) {
         console.error(error);
         displayMessage('bot', `チャットの初期化中にエラーが発生しました。APIキーが正しいか確認してください。`);
         setFormDisabled(true);
    }
}

/**
 * Handles form submission to send a message.
 * @param {Event} e The form submission event.
 */
async function handleFormSubmit(e: Event) {
  e.preventDefault();
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  displayMessage('user', userMessage);
  chatInput.value = '';

  await getAndStreamResponse(userMessage);
}

/**
 * Displays a message in the chat history.
 * @param {'user' | 'bot'} role The role of the message sender.
 * @param {string} text The message content.
 * @param {boolean} isLoading - Whether the message is still loading.
 * @returns {HTMLElement} The created message content element.
 */
function displayMessage(role: 'user' | 'bot', text: string, isLoading = false): HTMLElement {
  const messageContainer = document.createElement('div');
  messageContainer.className = `chat-message ${role}`;

  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  if (isLoading) {
    messageContent.classList.add('loading');
  }
  // Use marked to sanitize and render markdown
  messageContent.innerHTML = text ? marked.parse(text) as string : '';

  messageContainer.appendChild(messageContent);
  chatHistory.appendChild(messageContainer);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  return messageContent;
}

/**
 * Sets the disabled state of the input form.
 * @param {boolean} isDisabled Whether the form should be disabled.
 */
function setFormDisabled(isDisabled: boolean) {
  chatInput.disabled = isDisabled;
  sendButton.disabled = isDisabled;
}

// Event Listeners
chatForm.addEventListener('submit', handleFormSubmit);

// Initialize
initializeChat().catch(console.error);