import React, { useState, useMemo, useCallback, useEffect } from 'react';
import StoryGenerator from './components/StoryGenerator';
import Chatbot from './components/Chatbot';
import { ChatIcon, LoadingSpinner } from './components/icons/AppIcons';
import { StoryParagraph } from './types';
import { applySuggestionToStory } from './services/geminiService';

const App: React.FC = () => {
  const [isChatVisible, setIsChatVisible] = useState<boolean>(true);
  const [storyParts, setStoryParts] = useState<StoryParagraph[] | null>(null);
  const [isApplyingSuggestion, setIsApplyingSuggestion] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedText, setHighlightedText] = useState<string | null>(null);

  const chatButtonClasses = `lg:hidden flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-300 transform hover:scale-105 ${
      isChatVisible
        ? 'bg-indigo-600 text-white shadow-lg'
        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`;
    
  const storyTextForChat = useMemo(() => {
    if (!storyParts) return "";
    return storyParts.map(p => p.chunks.map(c => c.text).join(' ')).join('\n\n');
  }, [storyParts]);

  useEffect(() => {
    // When storyParts is updated with 'changed' flags, set a timer to remove them.
    const hasChanges = storyParts?.some(p => p.chunks.some(c => c.changed));
    if (hasChanges) {
      const timer = setTimeout(() => {
        setStoryParts(currentParts =>
          currentParts?.map(p => ({
            ...p,
            chunks: p.chunks.map(c => ({ ...c, changed: false })),
          })) || null
        );
      }, 8000); // Highlight lasts for 8 seconds

      return () => clearTimeout(timer);
    }
  }, [storyParts]);

  const handleApplySuggestion = useCallback(async (suggestion: string) => {
    if (!storyTextForChat) return;

    setIsApplyingSuggestion(true);
    setError(null);
    try {
        const newStoryParts = await applySuggestionToStory(storyTextForChat, suggestion);
        setStoryParts(newStoryParts);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Impossibile applicare il suggerimento.');
    } finally {
        setIsApplyingSuggestion(false);
    }
  }, [storyTextForChat]);

  return (
    <div className="min-h-screen lg:h-screen bg-gray-900 text-gray-100 flex flex-col p-4 sm:p-6 md:p-8 lg:overflow-hidden">
      <div className="w-full max-w-7xl mx-auto flex flex-col flex-1 h-full">
        <header className="text-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
            Cantastorie AI: Scrittura & Narrazione
          </h1>
          <p className="text-gray-400 mt-2">
            Dove la tua immaginazione incontra l'intelligenza artificiale.
          </p>
        </header>

        <div className="flex justify-center mb-6">
            <button
              onClick={() => setIsChatVisible(!isChatVisible)}
              className={chatButtonClasses}
            >
              <ChatIcon />
              {isChatVisible ? 'Nascondi Chat' : 'Mostra AI Writing Coach'}
            </button>
        </div>
         {isApplyingSuggestion && (
          <div className="mb-4 flex items-center justify-center gap-2 text-indigo-300">
            <LoadingSpinner />
            <span>Applico il suggerimento alla storia...</span>
          </div>
        )}
        {error && <div className="mb-4 bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg text-center">{error}</div>}
        
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 lg:overflow-hidden">
          <div className={`transition-all duration-500 ease-in-out ${isChatVisible ? 'lg:col-span-2' : 'lg:col-span-3'} lg:overflow-y-auto lg:pr-4`}>
             <div className="bg-gray-800/50 rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 border border-gray-700 backdrop-blur-sm min-h-[50vh] lg:h-full">
                <StoryGenerator 
                    storyParts={storyParts}
                    onStoryChange={setStoryParts}
                    isApplyingSuggestion={isApplyingSuggestion}
                    highlightedText={highlightedText}
                />
            </div>
          </div>
          
          <div className={`${isChatVisible ? 'block' : 'hidden'} lg:block lg:col-span-1 ${!isChatVisible ? 'lg:hidden' : ''} flex flex-col`}>
            <div className="bg-gray-800/50 rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 border border-gray-700 backdrop-blur-sm h-full flex flex-col">
                <h2 className="text-2xl font-semibold mb-1 text-indigo-300">AI Writing Coach</h2>
                <p className="text-sm text-gray-400 mb-4">L'assistente conosce la tua storia. Chiedigli consigli!</p>
                <Chatbot 
                    storyContext={storyTextForChat} 
                    onApplySuggestion={handleApplySuggestion}
                    isApplyingSuggestion={isApplyingSuggestion}
                    onHighlightChange={setHighlightedText}
                />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;