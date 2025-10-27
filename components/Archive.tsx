import React, { useState, useEffect } from 'react';
import { getSavedStories } from '../services/storageService';
import { SavedStory } from '../types';
import { BookOpenIcon, DeleteIcon, GenreIcon, IllustrateIcon, InfoIcon, NewStoryIcon, RefineIcon } from './icons/FeatureIcons';

interface ArchiveProps {
    onEdit: (id: string) => void;
    onDelete: (id: string) => Promise<void>;
    onNew: () => void;
}

const Archive: React.FC<ArchiveProps> = ({ onEdit, onDelete, onNew }) => {
    const [stories, setStories] = useState<SavedStory[]>([]);
    const [storyToDelete, setStoryToDelete] = useState<SavedStory | null>(null);

    useEffect(() => {
        const fetchStories = async () => {
            const savedStories = await getSavedStories();
            setStories(savedStories);
        };
        fetchStories();
    }, []);

    const handleDeleteClick = (story: SavedStory) => {
        setStoryToDelete(story);
    };

    const confirmDelete = async () => {
        if (storyToDelete) {
            await onDelete(storyToDelete.id);
            setStories(stories.filter(s => s.id !== storyToDelete.id));
            setStoryToDelete(null);
        }
    };

    if (stories.length === 0) {
        return (
            <div className="text-center py-20">
                <h2 className="text-3xl font-bold text-gray-400">Il tuo archivio è vuoto.</h2>
                <p className="text-gray-500 mt-4">Inizia a scrivere la tua prima storia!</p>
                <button 
                    onClick={onNew}
                    className="mt-8 inline-flex items-center gap-3 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-all duration-200 transform hover:scale-105"
                >
                    <NewStoryIcon />
                    Crea una Nuova Storia
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-indigo-400">Archivio Storie</h2>
                 <button 
                    onClick={onNew}
                    className="inline-flex items-center gap-3 bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                >
                    <NewStoryIcon />
                    Crea Nuova
                </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-y-auto h-[calc(100vh-20rem)] pb-8 pr-4 -mr-4">
                {stories.map(story => {
                    const storyArcStep = Math.min(story.storyParts.length, 3);
                    return (
                        <div key={story.id} className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg flex flex-col overflow-hidden group transition-all duration-300 hover:shadow-indigo-500/20 hover:border-indigo-700">
                            <div className="relative h-40">
                                <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                <h3 className="absolute bottom-2 left-3 text-lg font-bold text-white drop-shadow-md">{story.title}</h3>
                            </div>
                            <div className="p-4 flex flex-col flex-grow">
                               <div className="mb-3">
                                    <div className="w-full bg-gray-700 rounded-full h-1.5 flex items-center">
                                        <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${(storyArcStep / 3) * 100}%` }}></div>
                                    </div>
                                    <p className="text-xs text-gray-500 text-right mt-1">{storyArcStep}/3 completato</p>
                               </div>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-3">
                                    <span className="flex items-center gap-1.5 bg-gray-700/50 px-2 py-0.5 rounded-full" title="Genere">
                                        <GenreIcon /> {story.genre}
                                    </span>
                                    {story.isRefined && (
                                        <span className="flex items-center gap-1.5 bg-gray-700/50 px-2 py-0.5 rounded-full" title="Storia Affinata">
                                            <RefineIcon /> Affinata
                                        </span>
                                    )}
                                     <span className="flex items-center gap-1.5 bg-gray-700/50 px-2 py-0.5 rounded-full" title="Illustrazioni">
                                        <IllustrateIcon /> {story.illustrationCount}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 flex-grow">Modificato: {new Date(story.lastModified).toLocaleString()}</p>
                                
                                <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center gap-2">
                                     <button 
                                        onClick={() => onEdit(story.id)}
                                        className="inline-flex items-center justify-center gap-2 flex-1 bg-indigo-600 text-white font-bold py-2 px-3 rounded-md hover:bg-indigo-700 transition-colors text-sm"
                                    >
                                        <BookOpenIcon /> Carica
                                    </button>
                                     <button 
                                        onClick={() => handleDeleteClick(story)}
                                        className="inline-flex items-center justify-center p-2 bg-red-800/50 text-red-300 rounded-md hover:bg-red-800 hover:text-white transition-colors"
                                        title="Elimina Storia"
                                    >
                                        <DeleteIcon />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {storyToDelete && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-800 border border-red-700 rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
                        <h3 className="text-xl font-bold text-red-400 mb-2">Conferma Eliminazione</h3>
                        <p className="text-gray-300 mb-6">Vuoi eliminare definitivamente la storia "<span className="font-semibold">{storyToDelete.title}</span>"? L'azione è irreversibile.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setStoryToDelete(null)} className="py-2 px-6 bg-gray-600 rounded-lg hover:bg-gray-500">
                                Annulla
                            </button>
                            <button onClick={confirmDelete} className="py-2 px-6 bg-red-600 text-white rounded-lg hover:bg-red-700">
                                Elimina
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Archive;