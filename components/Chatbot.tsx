
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { chatWithBot } from '../services/geminiService';
import { BotIcon, UserIcon, SendIcon, LoadingSpinner } from './icons/FeatureIcons';

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! How can I help you today?' },
  ]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = userInput.trim();
    if (!trimmedInput || isLoading) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', text: trimmedInput }];
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);

    try {
      const botResponse = await chatWithBot(newMessages, trimmedInput);
      setMessages([...newMessages, { role: 'model', text: botResponse }]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sorry, something went wrong.";
      setMessages([...newMessages, { role: 'model', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[60vh]">
      <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 flex-shrink-0 bg-indigo-500 rounded-full flex items-center justify-center">
                <BotIcon />
              </div>
            )}
            <div className={`max-w-md p-3 rounded-xl ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-700 text-gray-200 rounded-bl-none'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
             {msg.role === 'user' && (
              <div className="w-8 h-8 flex-shrink-0 bg-gray-600 rounded-full flex items-center justify-center">
                <UserIcon />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
            <div className="flex items-start gap-3">
                 <div className="w-8 h-8 flex-shrink-0 bg-indigo-500 rounded-full flex items-center justify-center">
                    <BotIcon />
                </div>
                 <div className="max-w-md p-3 rounded-xl bg-gray-700 text-gray-200 rounded-bl-none">
                    <LoadingSpinner />
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="mt-6 flex items-center gap-3">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ask me anything..."
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !userInput.trim()}
          className="bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
};

export default Chatbot;
