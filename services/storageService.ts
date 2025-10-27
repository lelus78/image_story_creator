import { SavedStory } from '../types';

const DB_NAME = 'AIStoryArchive';
const DB_VERSION = 1;
const STORE_NAME = 'stories';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            console.error('Database error:', (event.target as IDBOpenDBRequest).error);
            reject('Errore nell\'apertura del database.');
        };
    });

    return dbPromise;
};

export const getSavedStories = async (): Promise<SavedStory[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const stories = request.result as SavedStory[];
            // Sort by most recently modified
            stories.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
            resolve(stories);
        };

        request.onerror = () => {
            console.error('Error fetching stories:', request.error);
            reject('Impossibile recuperare le storie.');
        };
    });
};

export const saveStory = async (story: SavedStory): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(story);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error('Error saving story:', request.error);
            reject('Impossibile salvare la storia.');
        };
    });
};

export const getStory = async (id: string): Promise<SavedStory | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve((request.result as SavedStory) || null);
        };

        request.onerror = () => {
            console.error('Error getting story:', request.error);
            reject(`Impossibile trovare la storia con id: ${id}`);
        };
    });
};

export const deleteStory = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error('Error deleting story:', request.error);
            reject('Impossibile eliminare la storia.');
        };
    });
};
