
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface StoryParagraph {
  chunks: string[];
  image: string | null; // Base64 Data URL for the generated image
}
