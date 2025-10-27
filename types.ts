import { Content } from "@google/genai";

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  suggestions?: ActionableSuggestion[];
}

export interface StoryChunk {
  text: string;
  changed?: boolean;
}

export interface StoryParagraph {
  chunks: StoryChunk[];
  image: string | null; // Base64 Data URL for the generated image
}

export interface ActionableSuggestion {
    suggestion: string;
    targetText?: string;
}

export interface ChatResponse {
    responseText: string;
    actionableSuggestions?: ActionableSuggestion[];
}

export interface SavedStory {
    id: string;
    title: string;
    coverImage: string;
    coverImageFile: File;
    storyParts: StoryParagraph[];
    anchorImage: string | null; // The first generated illustration to use as a character anchor
    genre: string;
    theme: string;
    characters: string;
    location: string;
    lastModified: string; // ISO string date
    isRefined: boolean;
    illustrationCount: number;
}