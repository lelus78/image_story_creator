import React, { useState, useMemo, useCallback, useEffect } from 'react';
import StoryGenerator from './components/StoryGenerator';
import Chatbot from './components/Chatbot';
import { ChatIcon, LoadingSpinner, WriterIcon, ArchiveIcon } from './components/icons/AppIcons';
import Archive from './components/Archive';
import { StoryParagraph, SavedStory } from './types';
import { applySuggestionToStory } from './services/geminiService';
import { saveStory as saveStoryToStorage, getStory as getStoryFromStorage, deleteStory as deleteStoryFromStorage } from './services/storageService';


const App: React.FC = () => {
  const [view, setView] = useState<'editor' | 'archive'>('editor');
  const [isChatVisible, setIsChatVisible] = useState<boolean>(true);
  
  // Story State
  const [storyParts, setStoryParts] = useState<StoryParagraph[] | null>(null);
  const [initialImage, setInitialImage] = useState<string | null>(null);
  const [initialImageFile, setInitialImageFile] = useState<File | null>(null);
  const [genre, setGenre] = useState<string>('Fantasy');
  const [theme, setTheme] = useState<string>('');
  const [characters, setCharacters] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);

  const [isApplyingSuggestion, setIsApplyingSuggestion] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

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
    const hasChanges = storyParts?.some(p => p.chunks.some(c => c.changed));
    if (hasChanges) {
      const timer = setTimeout(() => {
        setStoryParts(currentParts =>
          currentParts?.map(p => ({
            ...p,
            chunks: p.chunks.map(c => ({ ...c, changed: false })),
          })) || null
        );
      }, 8000); 
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

  const handleSaveStory = useCallback(async () => {
    if (!storyParts || !initialImage || !initialImageFile) {
        setError("Impossibile salvare: mancano la storia o l'immagine di copertina.");
        return;
    }

    const storyToSave: SavedStory = {
        id: currentStoryId || `story-${Date.now()}`,
        title: selectedTitle || 'Senza Titolo',
        coverImage: initialImage,
        coverImageFile: initialImageFile,
        storyParts,
        genre,
        theme,
        characters,
        location,
        lastModified: new Date().toISOString(),
        isRefined: storyParts.some(p => p.chunks.some(c => c.changed === false)), // A simple heuristic
        illustrationCount: storyParts.filter(p => p.image).length,
    };

    try {
        await saveStoryToStorage(storyToSave);
        setCurrentStoryId(storyToSave.id!);
        setLastSaved(new Date());
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore durante il salvataggio della storia.');
    }
  }, [storyParts, initialImage, initialImageFile, currentStoryId, selectedTitle, genre, theme, characters, location]);

  const handleLoadStory = useCallback(async (storyId: string) => {
      const story = await getStoryFromStorage(storyId);
      if (story) {
          setStoryParts(story.storyParts);
          setInitialImage(story.coverImage);
          setInitialImageFile(story.coverImageFile);
          setGenre(story.genre);
          setTheme(story.theme);
          setCharacters(story.characters);
          setLocation(story.location);
          setSelectedTitle(story.title);
          setCurrentStoryId(story.id);
          setView('editor');
          setError(null);
          setLastSaved(new Date(story.lastModified));
      } else {
          setError("Impossibile caricare la storia. Potrebbe essere stata rimossa.");
      }
  }, []);
  
  const handleNewStory = () => {
      setStoryParts(null);
      setInitialImage(null);
      setInitialImageFile(null);
      setGenre('Fantasy');
      setTheme('');
      setCharacters('');
      setLocation('');
      setSelectedTitle(null);
      setCurrentStoryId(null);
      setError(null);
      setLastSaved(null);
      setView('editor');
  }

  const handleDeleteStory = useCallback(async (storyId: string) => {
      await deleteStoryFromStorage(storyId);
      // Force re-render of archive view by toggling view
      setView('editor');
      setTimeout(() => setView('archive'), 0);
  }, []);

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

        <nav className="flex justify-center items-center mb-6 bg-gray-800/50 p-2 rounded-lg border border-gray-700 w-full max-w-md mx-auto">
            <button onClick={() => setView('editor')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${view === 'editor' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}>
                <WriterIcon /> Scrivi
            </button>
            <button onClick={() => setView('archive')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${view === 'archive' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}>
                <ArchiveIcon /> Archivio
            </button>
        </nav>

        {view === 'editor' ? (
          <>
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
                        // Pass all story state and handlers
                        image={initialImage}
                        imageFile={initialImageFile}
                        genre={genre}
                        theme={theme}
                        characters={characters}
                        location={location}
                        selectedTitle={selectedTitle}
                        storyId={currentStoryId}
                        lastSaved={lastSaved}
                        onImageChange={(img, file) => { setInitialImage(img); setInitialImageFile(file); }}
                        onGenreChange={setGenre}
                        onThemeChange={setTheme}
                        onCharactersChange={setCharacters}
                        onLocationChange={setLocation}
                        onTitleChange={setSelectedTitle}
                        onSave={handleSaveStory}
                        onNewStory={handleNewStory}
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
          </>
        ) : (
            <Archive onEdit={handleLoadStory} onDelete={handleDeleteStory} onNew={handleNewStory} />
        )}
      </div>
    </div>
  );
};

export default App;