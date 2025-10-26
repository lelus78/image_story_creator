
import React, { useState } from 'react';
import { AppView } from './types';
import StoryGenerator from './components/StoryGenerator';
import Chatbot from './components/Chatbot';
import { WriterIcon, ChatIcon } from './components/icons/AppIcons';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>(AppView.Story);

  const navButtonClasses = (view: AppView) =>
    `flex items-center gap-2 px-4 py-2 rounded-md transition-colors duration-200 ${
      activeView === view
        ? 'bg-indigo-600 text-white shadow-md'
        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
            Cantastorie AI: Scrittura & Narrazione
          </h1>
          <p className="text-gray-400 mt-2">
            Dove la tua immaginazione incontra l'intelligenza artificiale.
          </p>
        </header>

        <nav className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setActiveView(AppView.Story)}
            className={navButtonClasses(AppView.Story)}
          >
            <WriterIcon />
            Crea Storia
          </button>
          <button
            onClick={() => setActiveView(AppView.Chat)}
            className={navButtonClasses(AppView.Chat)}
          >
            <ChatIcon />
            AI Chatbot
          </button>
        </nav>

        <main className="bg-gray-800/50 rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 border border-gray-700 backdrop-blur-sm">
          {activeView === AppView.Story && <StoryGenerator />}
          {activeView === AppView.Chat && <Chatbot />}
        </main>
      </div>
    </div>
  );
};

export default App;