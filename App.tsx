
import React, { useState } from 'react';
import StoryGenerator from './components/StoryGenerator';
import Chatbot from './components/Chatbot';
import { ChatIcon } from './components/icons/AppIcons';

const App: React.FC = () => {
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false);

  const chatButtonClasses = `flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-300 transform hover:scale-105 ${
      isChatVisible
        ? 'bg-indigo-600 text-white shadow-lg'
        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
            Cantastorie AI: Scrittura & Narrazione
          </h1>
          <p className="text-gray-400 mt-2">
            Dove la tua immaginazione incontra l'intelligenza artificiale.
          </p>
        </header>

        <div className="flex justify-center mb-8">
            <button
              onClick={() => setIsChatVisible(!isChatVisible)}
              className={chatButtonClasses}
            >
              <ChatIcon />
              {isChatVisible ? 'Nascondi Chatbot' : 'Mostra AI Chatbot'}
            </button>
        </div>
        
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className={`transition-all duration-500 ease-in-out ${isChatVisible ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
             <div className="bg-gray-800/50 rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 border border-gray-700 backdrop-blur-sm h-full">
                <StoryGenerator />
            </div>
          </div>
          
          <div className={`${isChatVisible ? 'block' : 'hidden'} lg:block lg:col-span-1 ${!isChatVisible ? 'lg:hidden' : ''}`}>
            <div className="bg-gray-800/50 rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 border border-gray-700 backdrop-blur-sm h-full">
                <h2 className="text-2xl font-semibold mb-4 text-indigo-300">Assistente AI</h2>
                <Chatbot />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
