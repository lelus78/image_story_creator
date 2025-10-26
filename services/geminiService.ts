import { GoogleGenAI, Modality } from "@google/genai";
import { ChatMessage } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generateStoryFromImage = async (imageData: string, mimeType: string, theme?: string): Promise<string> => {
  try {
    const imagePart = {
      inlineData: {
        data: imageData,
        mimeType: mimeType,
      },
    };

    let promptText = "Usa questa immagine come ispirazione. Scrivi un paragrafo di apertura avvincente e fantasioso per una storia fantasy o di fantascienza in italiano. Il testo deve essere impeccabile dal punto di vista grammaticale e stilistico, con un lessico ricco e una prosa fluida ed evocativa. Non descrivere l'immagine. Invece, crea una scena e un'atmosfera che catturino l'essenza dell'immagine, introducendo un mistero o un personaggio intrigante. Il tono dovrebbe attirare il lettore nel mondo che hai creato."
    
    if (theme && theme.trim() !== '') {
        promptText += `\n\nIncorpora specificamente questo tema o queste parole chiave nella storia: "${theme}".`;
    }

    const textPart = {
      text: promptText
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating story from image:", error);
    throw new Error("Failed to generate story. Please try again.");
  }
};

export const textToSpeech = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data received from API.");
    }
    return base64Audio;
  } catch (error) {
    console.error("Error with text-to-speech:", error);
    throw new Error("Failed to generate audio. Please try again.");
  }
};


export const chatWithBot = async (history: ChatMessage[], message: string): Promise<string> => {
    try {
        // We will build a simple prompt from the last few messages.
        // For a more robust solution, a proper chat history would be passed.
        const prompt = `
            You are a helpful AI assistant.
            The user is asking: ${message}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error chatting with bot:", error);
        throw new Error("I'm having trouble responding right now. Please try again later.");
    }
};