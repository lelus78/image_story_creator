// @google/genai-sdk-remediation: V1.5.0
import { GoogleGenAI, Modality, Type, Content } from "@google/genai";
// FIX: import ChatMessage type
import { StoryParagraph, ChatResponse, StoryChunk, ActionableSuggestion, ChatMessage } from '../types';

// Helper to initialize the API
const getGenAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    // In a real app, you might want to show a more user-friendly error
    throw new Error("API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Splits a long text into smaller, manageable chunks based on sentence endings.
 * This helps in rendering the story progressively and applying chunk-level features.
 * @param text The full text of a paragraph.
 * @returns An array of StoryChunk objects.
 */
const chunkText = (text: string): StoryChunk[] => {
    if (!text) return [];
    // Split by sentences to find natural breaking points.
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
        // If adding the next sentence makes the chunk too long, push the current one.
        if ((currentChunk + sentence).length > 250 && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        currentChunk += sentence;
    }

    // Add the last remaining chunk.
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
    }
    
    const finalChunks = chunks.length > 0 ? chunks : [text];
    return finalChunks.map(c => ({ text: c, changed: false }));
};


export const generateStoryFromImage = async (
  base64Data: string,
  mimeType: string,
  genre: string,
  theme: string,
  characters: string,
  location: string
): Promise<StoryChunk[]> => {
  const ai = getGenAI();

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: mimeType,
    },
  };

  let prompt = `Scrivi l'inizio di una storia basandoti su questa immagine, in lingua italiana.
Genere: ${genre}.`;
  if (theme) prompt += `\nTema: ${theme}.`;
  if (characters) prompt += `\nPersonaggi: ${characters}.`;
  if (location) prompt += `\nLuogo: ${location}.`;
  prompt += `\nScrivi un paragrafo iniziale avvincente di circa 150 parole. La risposta deve essere esclusivamente in italiano.`;

  const textPart = { text: prompt };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
  });

  // FIX: Return StoryChunk[] as per function signature. The previous implementation returned string[].
  return chunkText(response.text);
};


export const textToSpeech = async (text: string): Promise<string> => {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text: `Leggi la seguente storia in italiano: ${text}` }] }],
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
      throw new Error('Audio generation failed. The response did not contain audio data.');
  }
  return base64Audio;
};


export const continueStory = async (
  currentStory: string,
  genre: string
): Promise<StoryChunk[]> => {
  const ai = getGenAI();
  const prompt = `Questa è una storia di genere ${genre} finora:\n\n${currentStory}\n\nContinua la storia con il prossimo paragrafo, scrivendo in italiano. Non ripetere nessuna parte della storia già fornita. Concentrati sullo sviluppo della trama in una direzione nuova e interessante. Scrivi circa 150 parole.`;

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
  });
  
  return chunkText(response.text);
};


export const concludeStory = async (
  currentStory: string,
  genre: string
): Promise<StoryChunk[]> => {
    const ai = getGenAI();
    const prompt = `Questa è una storia di genere ${genre} finora:\n\n${currentStory}\n\nScrivi un paragrafo finale appropriato e conclusivo per la storia, in italiano. Porta la narrazione a una fine soddisfacente. Non ripetere nessuna parte della storia già fornita. Scrivi circa 150 parole.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    return chunkText(response.text);
};

export const suggestTitles = async (storyText: string): Promise<string[]> => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Basandoti sulla seguente storia, suggerisci 5 titoli creativi e appropriati in lingua italiana. Restituisci SOLO un array JSON di stringhe.\n\nStoria:\n${storyText}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
            },
        },
    });

    try {
        const jsonStr = response.text.trim();
        const titles = JSON.parse(jsonStr);
        if (Array.isArray(titles) && titles.every(t => typeof t === 'string')) {
            return titles;
        }
        throw new Error('Invalid format for titles received from AI.');
    } catch (e) {
        console.error("Failed to parse titles JSON:", response.text, e);
        throw new Error("Could not get title suggestions from the AI. The format was incorrect.");
    }
};

export const regenerateChunk = async (
    paragraphContext: string,
    chunkToRegenerate: string,
    hint?: string
): Promise<string> => {
    const ai = getGenAI();
    let prompt = `All'interno di questo paragrafo:\n"${paragraphContext}"\n\nRiscrivi la seguente parte in italiano: "${chunkToRegenerate}"`;
    if (hint) {
        prompt += `\nTieni a mente questo suggerimento: "${hint}"`;
    }
    prompt += `\n\nRestituisci SOLO la parte riscritta, in italiano, senza testo aggiuntivo, spiegazioni o virgolette.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0.8 // A bit more creative for regeneration
        }
    });
    
    // Clean up response in case it includes quotes or other artifacts
    return response.text.trim().replace(/^"|"$/g, '');
};

interface StoryContext {
    before: string;
    after: string;
}

export const regenerateParagraph = async (
    storyContext: StoryContext,
    paragraphToRegenerate: string,
    hint?: string
): Promise<StoryChunk[]> => {
    const ai = getGenAI();
    let prompt = `Ecco una storia. Voglio riscrivere uno dei paragrafi in italiano.\n\n`;
    if (storyContext.before) {
        prompt += `Parte della storia prima del paragrafo da riscrivere:\n${storyContext.before}\n\n`;
    }
    prompt += `Il paragrafo da riscrivere è:\n"${paragraphToRegenerate}"\n\n`;
    if (storyContext.after) {
        prompt += `Parte della storia dopo il paragrafo da riscrivere:\n${storyContext.after}\n\n`;
    }
    prompt += 'Per favore, riscrivi il paragrafo in italiano, assicurandoti che sia coerente con il resto della storia.';
    if (hint) {
        prompt += ` Tieni a mente questo specifico suggerimento: "${hint}"`;
    }
    prompt += `\n\nRestituisci SOLO il testo completo del nuovo paragrafo. Non includere frasi introduttive come "Ecco il paragrafo riscritto:".`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    return chunkText(response.text);
};


export const refineStory = async (currentStoryParts: StoryParagraph[]): Promise<StoryParagraph[]> => {
    const ai = getGenAI();
    const currentStory = currentStoryParts.map(p => p.chunks.map(c => c.text).join(' ')).join('\n\n');
    const prompt = `Affina la seguente storia, che è in italiano. Il tuo compito è migliorare la prosa, il ritmo e le descrizioni, mantenendo intatti la trama principale, i personaggi e il tono. La risposta deve essere in italiano. La storia è attualmente divisa in paragrafi da doppi a capo. Restituisci la storia affinata come un array JSON in cui ogni elemento è un oggetto con una chiave "paragraph" contenente il testo del paragrafo.\n\nStoria:\n${currentStory}`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro", // Use a more powerful model for this complex task
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        paragraph: {
                            type: Type.STRING,
                            description: 'The text of a single refined paragraph of the story.'
                        }
                    },
                    required: ['paragraph'],
                }
            },
        },
    });

    try {
        const jsonStr = response.text.trim();
        const refinedData: { paragraph: string }[] = JSON.parse(jsonStr);
        if (!Array.isArray(refinedData) || !refinedData.every(item => item && typeof item.paragraph === 'string')) {
            throw new Error('Invalid format for refined story received from AI.');
        }

        const preserveImages = refinedData.length === currentStoryParts.length;

        return refinedData.map((item, index) => ({
            chunks: chunkText(item.paragraph),
            image: preserveImages ? currentStoryParts[index].image : null
        }));
    } catch (e) {
        console.error("Failed to parse refined story JSON:", response.text, e);
        throw new Error("Could not refine the story due to an issue with the AI's response format.");
    }
};

export const generateImageForParagraph = async (
  paragraphText: string,
  initialImageBase64: string,
  initialImageMimeType: string
): Promise<string> => {
    const ai = getGenAI();
    
    const imagePart = {
        inlineData: {
            data: initialImageBase64,
            mimeType: initialImageMimeType,
        },
    };
    
    const textPart = {
        text: `Sei un illustratore. Il tuo compito è creare un'immagine basata su una descrizione testuale. Devi abbinare lo stile artistico di un'immagine di riferimento che ti viene fornita. Non modificare l'immagine di riferimento. Crea una nuova illustrazione da zero.\n\nDescrizione della scena: "${paragraphText}"`,
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [imagePart, textPart],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
    }
    
    // If we reach here, image generation failed. Provide a more detailed error.
    let errorMessage = "Generazione immagine fallita. La risposta non conteneva dati immagine.";
    
    if (response.text) {
         errorMessage = `L'API ha restituito un messaggio di testo invece di un'immagine: "${response.text}"`;
    } else if (response.candidates?.[0]?.finishReason && response.candidates[0].finishReason !== 'STOP') {
        const finishReason = response.candidates[0].finishReason;
        errorMessage += ` Motivo del fallimento: ${finishReason}.`;

        if (finishReason === 'NO_IMAGE') {
            errorMessage += ` L'IA non è riuscita a creare un'immagine basata su questo paragrafo. Prova a rigenerare il testo del paragrafo o a renderlo più descrittivo.`
        }

        const safetyRatings = response.candidates[0].safetyRatings;
        if (safetyRatings && safetyRatings.some(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')) {
             errorMessage += ` Questo è probabilmente dovuto ai filtri di sicurezza.`;
        }
    }

    console.error("Image generation failed. Full API response:", JSON.stringify(response, null, 2));
    throw new Error(errorMessage);
};


export const suggestPlotTwists = async (storyText: string): Promise<string[]> => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Basandoti sulla seguente storia, suggerisci 3 colpi di scena sorprendenti e interessanti in lingua italiana che potrebbero essere introdotti. Restituisci SOLO un array JSON di stringhe, dove ogni stringa è un suggerimento di colpo di scena.\n\nStoria:\n${storyText}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
            },
        },
    });

    try {
        const jsonStr = response.text.trim();
        const twists = JSON.parse(jsonStr);
        if (Array.isArray(twists) && twists.every(t => typeof t === 'string')) {
            return twists;
        }
        throw new Error('Invalid format for plot twists received from AI.');
    } catch (e) {
        console.error("Failed to parse plot twists JSON:", response.text, e);
        throw new Error("Could not get plot twist suggestions from the AI. The format was incorrect.");
    }
};

export const chatWithBot = async (
    messageHistory: ChatMessage[],
    newUserMessage: string,
    storyContext: string
): Promise<ChatResponse> => {
    const ai = getGenAI();

    const history: Content[] = messageHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          ...history,
          { role: 'user', parts: [{text: newUserMessage }] }
        ],
        config: {
            systemInstruction: `Sei un AI Writing Coach. L'utente sta scrivendo una storia in italiano. Ecco la versione attuale della sua storia:\n\n---\n${storyContext || "(L'utente non ha ancora scritto nulla.)"}\n---\n\nIl tuo ruolo è fornire feedback costruttivo. Rispondi in italiano. La tua risposta DEVE essere un oggetto JSON. L'oggetto deve avere una chiave 'responseText' (string) con la tua risposta, e può avere una chiave opzionale 'actionableSuggestions' (array di oggetti). Usa 'actionableSuggestions' per suggerimenti concreti che potrebbero riscrivere parte della storia. Ogni oggetto deve avere una chiave 'suggestion' (stringa del suggerimento) e una chiave opzionale 'targetText' (stringa con la citazione ESATTA dalla storia a cui si riferisce il suggerimento). Esempio: { "responseText": "Ottima idea!", "actionableSuggestions": [{ "suggestion": "Riscrivi il dialogo per renderlo più teso.", "targetText": "disse Elara con calma" }] }`,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    responseText: { type: Type.STRING },
                    actionableSuggestions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                suggestion: { type: Type.STRING },
                                targetText: { type: Type.STRING }
                            },
                            required: ['suggestion']
                        }
                    }
                },
                required: ['responseText']
            }
        }
    });

    try {
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr) as ChatResponse;
    } catch (e) {
        console.error("Failed to parse chatbot JSON response:", response.text, e);
        // Fallback for malformed JSON
        return { responseText: response.text || "Si è verificato un errore di formattazione della risposta.", actionableSuggestions: [] };
    }
};

export const applySuggestionToStory = async (
    currentStory: string,
    suggestion: string
): Promise<StoryParagraph[]> => {
    const ai = getGenAI();
    const prompt = `Ecco una storia in italiano:\n\n---\n${currentStory}\n---\n\nApplica questo suggerimento: "${suggestion}".\n\nRiscrivi l'intera storia incorporando il suggerimento. Restituisci un oggetto JSON con una chiave "story". Il valore di "story" deve essere un array di oggetti, dove ogni oggetto rappresenta un paragrafo e ha una chiave "chunks" che è un array di oggetti. Ogni oggetto chunk deve avere una chiave "text" (stringa) e una chiave "changed" (booleano, 'true' se il testo è nuovo o modificato, altrimenti 'false'). Mantieni la coerenza. Non aggiungere commenti. Restituisci solo l'oggetto JSON.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro', // Use a more powerful model for rewriting
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    story: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                chunks: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            text: { type: Type.STRING },
                                            changed: { type: Type.BOOLEAN }
                                        },
                                        required: ['text', 'changed']
                                    }
                                }
                            },
                            required: ['chunks']
                        }
                    }
                },
                required: ['story']
            }
        }
    });

    try {
        const jsonStr = response.text.trim();
        const result: { story: { chunks: StoryChunk[] }[] } = JSON.parse(jsonStr);
        return result.story.map(p => ({
            chunks: p.chunks,
            image: null // Applying a suggestion invalidates old illustrations
        }));
    } catch (e) {
        console.error("Failed to parse suggestion application JSON:", response.text, e);
        throw new Error("L'IA non è riuscita ad applicare il suggerimento correttamente.");
    }
};