
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ChatMessage } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

interface StoryChunk {
    speaker: "NARRATOR" | "MALE" | "FEMALE_1" | "FEMALE_2";
    text: string;
}

const baseGenerationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: Type.OBJECT,
        properties: {
            paragraph: {
                type: Type.ARRAY,
                items: {
                    type: Type.STRING,
                    description: "Una singola frase o un frammento coerente del paragrafo."
                },
            },
        },
        required: ["paragraph"],
    },
};

const genreInstructions: Record<string, { opening: string, continuation: string, conclusion: string }> = {
    "Fantasy": {
        opening: "Crea un'atmosfera di meraviglia e mistero antico. Concentrati su un elemento magico, una profezia, una creatura mitica o un manufatto leggendario. Il mondo deve sembrare vasto e ricco di storia.",
        continuation: "Approfondisci la lore del mondo. Fai in modo che il protagonista scopra un nuovo aspetto della magia, affronti una sfida legata a una creatura mitica o sveli un segreto del passato. L'azione dovrebbe essere epica.",
        conclusion: "Offri una conclusione epica e memorabile. La magia trionfa, una profezia si compie, o il mondo viene cambiato per sempre dalle azioni del protagonista. La risoluzione deve essere degna di una leggenda."
    },
    "Sci-Fi": {
        opening: "Immergi il lettore in un mondo futuristico o tecnologicamente avanzato. Introduci un concetto scientifico intrigante, un'anomalia tecnologica, un dilemma etico legato alla scienza o il primo contatto con l'ignoto.",
        continuation: "Esplora le implicazioni della tecnologia o del concetto introdotto. La tensione dovrebbe derivare dalla lotta per la sopravvivenza in un ambiente ostile, da un mistero tecnologico o da un conflitto ideologico.",
        conclusion: "Fornisci una risoluzione che sia intellettualmente soddisfacente. Il mistero tecnologico viene risolto, l'umanità fa un passo avanti (o indietro) o il protagonista prende una decisione che definisce il futuro."
    },
    "Horror": {
        opening: "Costruisci un'atmosfera di terrore e oppressione. Concentrati sull'ignoto, sull'inquietudine psicologica e sulla sensazione di essere osservati. L'evento scatenante deve essere sottile ma profondamente disturbante.",
        continuation: "Intensifica il terrore. La minaccia deve diventare più tangibile e personale. Gioca con la percezione del protagonista, facendolo dubitare della propria sanità mentale. L'isolamento è un elemento chiave.",
        conclusion: "Concludi con un climax terrificante. Il protagonista potrebbe sopravvivere ma rimanere segnato per sempre, soccombere all'orrore, o scoprire una verità ancora più spaventosa. Il finale non deve necessariamente essere positivo."
    },
    "Mystery": {
        opening: "Presenta un enigma avvincente: un crimine inspiegabile, una scomparsa misteriosa o un evento apparentemente impossibile. Introduci il detective o il personaggio centrale e fornisci il primo, cruciale indizio.",
        continuation: "Sviluppa l'indagine. Introduci nuovi sospetti, false piste e colpi di scena. Ogni paragrafo deve aggiungere un pezzo al puzzle, aumentando la complessità e la posta in gioco per chi indaga.",
        conclusion: "Svela la verità con un colpo di scena brillante e logico. Tutti gli indizi devono convergere. La rivelazione finale deve essere sorprendente ma coerente con la narrazione precedente, fornendo una chiusura completa all'enigma."
    },
    "Romance": {
        opening: "Descrivi un incontro significativo o un momento cruciale che accende la scintilla tra due personaggi. Concentrati sui loro sentimenti interiori, sulle prime impressioni e sulla tensione emotiva che si crea tra loro.",
        continuation: "Sviluppa la relazione. Esplora gli ostacoli (interni o esterni) che i personaggi devono superare. La narrazione deve essere guidata dal dialogo, dai gesti e dall'evoluzione dei loro sentimenti.",
        conclusion: "Porta la storia d'amore a una risoluzione emotivamente appagante. I personaggi superano gli ostacoli finali e dichiarano i loro sentimenti, culminando in un momento di unione e felicità che lasci il lettore soddisfatto."
    }
};

export const generateStoryFromImage = async (imageData: string, mimeType: string, genre: string, theme?: string, hint?: string): Promise<string[]> => {
  try {
    const imagePart = {
      inlineData: {
        data: imageData,
        mimeType: mimeType,
      },
    };

    const instructions = genreInstructions[genre] || genreInstructions.Fantasy;

    let promptText = `Sei un maestro della narrativa. Usa questa immagine come ispirazione per scrivere un'apertura di storia breve e potente in italiano (massimo due paragrafi) nel genere **${genre}**.
${instructions.opening}
Non limitarti a descrivere la scena; crea un evento o un'azione che dia il via alla trama. La prosa deve essere impeccabile. Suddividi il paragrafo in un array di frasi o frammenti di frase coerenti.`
    
    if (theme && theme.trim() !== '') {
        promptText += `\n\nIncorpora questo tema: "${theme}".`;
    }

    if (hint && hint.trim() !== '') {
        promptText += `\n\nConsidera questo suggerimento: "${hint}".`;
    }

    const textPart = {
      text: promptText
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: baseGenerationConfig,
    });
    
    const jsonResponse = JSON.parse(response.text);
    return jsonResponse.paragraph || [];
  } catch (error) {
    console.error("Error generating story from image:", error);
    throw new Error("Failed to generate story. Please try again.");
  }
};

export const continueStory = async (existingStory: string, genre: string, hint?: string): Promise<string[]> => {
  try {
    const instructions = genreInstructions[genre] || genreInstructions.Fantasy;
    let prompt = `Sei un maestro della narrativa. Continua la seguente storia **${genre}**, che ha già avuto il suo evento scatenante.
${instructions.continuation}
**Non ripetere l'impostazione iniziale.** Concentrati sulle conseguenze dirette dell'evento accaduto e fai avanzare la trama in modo significativo.
Sviluppa la direzione scelta in un paragrafo avvincente. Suddividi il paragrafo in un array di frasi o frammenti di frase coerenti.`;

    if (hint && hint.trim() !== '') {
        prompt += `\n\nConsidera questo suggerimento: "${hint}".`;
    }

    prompt += `\n\nSTORIA FINORA:\n${existingStory}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: baseGenerationConfig,
    });
    
    const jsonResponse = JSON.parse(response.text);
    return jsonResponse.paragraph || [];
  } catch (error) {
    console.error("Error continuing story:", error);
    throw new Error("Failed to continue the story. Please try again.");
  }
};

export const concludeStory = async (existingStory: string, genre: string, hint?: string): Promise<string[]> => {
  try {
    const instructions = genreInstructions[genre] || genreInstructions.Fantasy;
    let prompt = `Sei un maestro della narrativa. Concludi la seguente storia **${genre}**, che è arrivata al suo punto di massima tensione. Scrivi il **paragrafo finale**.
${instructions.conclusion}
**Non introdurre nuovi misteri.** Fornisci una risoluzione soddisfacente e d'impatto che leghi tutti i fili della narrazione.
Scrivi un paragrafo finale che dia un senso di chiusura. Suddividi il paragrafo in un array di frasi o frammenti di frase coerenti.`;

    if (hint && hint.trim() !== '') {
        prompt += `\n\nConsidera questo suggerimento: "${hint}".`;
    }

    prompt += `\n\nSTORIA FINORA:\n${existingStory}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: baseGenerationConfig,
    });
    
    const jsonResponse = JSON.parse(response.text);
    return jsonResponse.paragraph || [];
  } catch (error) {
    console.error("Error concluding story:", error);
    throw new Error("Failed to conclude the story. Please try again.");
  }
};

export const regenerateChunk = async (paragraphContext: string, chunkToRegenerate: string, hint?: string): Promise<string> => {
    try {
        let prompt = `Sei un editor letterario. Il tuo compito è riscrivere una singola frase all'interno di un paragrafo per migliorarla, mantenendo la coerenza con il resto del testo.

Questo è il paragrafo completo:
"${paragraphContext}"

Questa è la frase specifica da riscrivere:
"${chunkToRegenerate}"
`;

        if (hint && hint.trim() !== '') {
            prompt += `\nPer la riscrittura, segui questo suggerimento: "${hint}"`;
        } else {
            prompt += `\nRiscrivi la frase per renderla più vivida, d'impatto o evocativa.`;
        }

        prompt += `\n\n**Restituisci solo e soltanto la singola frase riscritta**, come testo semplice, senza virgolette, spiegazioni o qualsiasi altro testo aggiuntivo.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        return response.text.trim();
    } catch (error) {
        console.error("Error regenerating chunk:", error);
        throw new Error("Failed to regenerate the text. Please try again.");
    }
};

export const regenerateParagraph = async (
    storyContext: { before: string; after: string },
    paragraphToRegenerate: string,
    hint?: string
): Promise<string[]> => {
    try {
        let prompt = `Sei un editor letterario. Il tuo compito è riscrivere un intero paragrafo di una storia per migliorarlo, mantenendo la coerenza con il testo precedente e successivo.

Questo è il testo che viene PRIMA del paragrafo da riscrivere:
---
${storyContext.before || "(Nessun testo precedente)"}
---

Questo è il testo che viene DOPO:
---
${storyContext.after || "(Nessun testo successivo)"}
---

Questo è il paragrafo specifico da riscrivere:
"${paragraphToRegenerate}"
`;

        if (hint && hint.trim() !== '') {
            prompt += `\nPer la riscrittura, segui questo suggerimento: "${hint}"`;
        } else {
            prompt += `\nRiscrivi il paragrafo per renderlo più vivido, d'impatto o evocativo, assicurandoti che si colleghi fluidamente con il resto della narrazione.`;
        }

        prompt += `\n\n**Restituisci solo e soltanto il paragrafo riscritto**, formattato come un oggetto JSON con una singola chiave "paragraph" che contiene un array di stringhe (frasi o frammenti).`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: baseGenerationConfig,
        });

        const jsonResponse = JSON.parse(response.text);
        return jsonResponse.paragraph || [];
    } catch (error) {
        console.error("Error regenerating paragraph:", error);
        throw new Error("Failed to regenerate the paragraph. Please try again.");
    }
};


export const suggestTitles = async (story: string): Promise<string[]> => {
    try {
        const prompt = `Dato il seguente testo di una storia, suggerisci 5 titoli accattivanti in italiano. I titoli devono essere creativi e riflettere il tono e il contenuto della storia.\n\nTESTO:\n${story}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        titles: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING,
                            },
                        },
                    },
                    required: ["titles"],
                },
            },
        });
        
        const jsonResponse = JSON.parse(response.text);
        return jsonResponse.titles || [];

    } catch (error) {
        console.error("Error suggesting titles:", error);
        throw new Error("Failed to suggest titles. Please try again.");
    }
};

export const tagStoryForNarration = async (story: string): Promise<StoryChunk[]> => {
    try {
        const prompt = `Analizza il seguente testo di una storia. Suddividilo in un array di oggetti JSON. Ogni oggetto deve avere due chiavi: "speaker" e "text".
- Usa "NARRATOR" per le parti narrative.
- Usa "MALE" per i dialoghi pronunciati da un personaggio maschile.
- Usa "FEMALE_1" per il primo personaggio femminile che parla e "FEMALE_2" per il secondo, se presente. Se c'è un solo personaggio femminile, usa "FEMALE_1".
Sii molto preciso nell'attribuire i dialoghi basandoti su indicatori come "disse lui", "rispose lei", nomi o contesto. Raggruppa frasi consecutive dello stesso speaker in un unico oggetto.

TESTO:
---
${story}
---`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        script: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    speaker: { type: Type.STRING, description: "Can be NARRATOR, MALE, FEMALE_1, or FEMALE_2" },
                                    text: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["script"],
                },
            },
        });
        const jsonResponse = JSON.parse(response.text);
        if (Array.isArray(jsonResponse.script) && jsonResponse.script.every((s: any) => 'speaker' in s && 'text' in s)) {
             // Remap any old "FEMALE" tags to "FEMALE_1" for backward compatibility.
             return jsonResponse.script.map((chunk: any) => 
                chunk.speaker === 'FEMALE' ? { ...chunk, speaker: 'FEMALE_1' } : chunk
             );
        }
        console.warn("Script tagging returned unexpected format, falling back to single voice.");
        return [{ speaker: 'NARRATOR', text: story }];

    } catch (error) {
        console.warn("Could not tag story for narration, falling back to single voice.", error);
        return [{ speaker: 'NARRATOR', text: story }];
    }
};


export const textToSpeech = async (text: string): Promise<string> => {
    try {
        const taggedScript = await tagStoryForNarration(text);
        // FIX: Explicitly type `initialSpeakers` to prevent type widening to `string[]`, which causes a type error later.
        const initialSpeakers: StoryChunk['speaker'][] = Array.from(new Set(taggedScript.map(chunk => chunk.speaker)));
        
        let scriptForTts = taggedScript;
        let finalSpeakers: string[];

        // --- Smart Speaker Merging Logic ---
        // If we have 3 or more speakers, we must merge down to 2.
        if (initialSpeakers.length >= 3) {
            const hasNarrator = initialSpeakers.includes('NARRATOR');
            const hasMale = initialSpeakers.includes('MALE');
            const hasFemale1 = initialSpeakers.includes('FEMALE_1');
            const hasFemale2 = initialSpeakers.includes('FEMALE_2');

            // Priority: Keep Narrator and one other distinct voice.
            if (hasNarrator && hasMale) { // N, M, F1 -> Merge F1 into N
                scriptForTts = taggedScript.map(chunk => (chunk.speaker === 'FEMALE_1' || chunk.speaker === 'FEMALE_2') ? { ...chunk, speaker: 'NARRATOR' } : chunk);
            } else if (hasNarrator && hasFemale1 && hasFemale2) { // N, F1, F2 -> Merge F2 into N
                scriptForTts = taggedScript.map(chunk => chunk.speaker === 'FEMALE_2' ? { ...chunk, speaker: 'NARRATOR' } : chunk);
            } else {
                 // Fallback for other complex cases (e.g., M, F1, F2): merge the last detected speaker into the first.
                 const [firstSpeaker, secondSpeaker, ...othersToMerge] = initialSpeakers;
                 const mergeSet = new Set(othersToMerge);
                 // FIX: Removed unnecessary type casts. The explicit typing of `initialSpeakers` ensures `firstSpeaker` has the correct type.
                 scriptForTts = taggedScript.map(chunk => mergeSet.has(chunk.speaker) ? { ...chunk, speaker: firstSpeaker } : chunk);
            }
        }
        
        finalSpeakers = Array.from(new Set(scriptForTts.map(chunk => chunk.speaker)));

        let response;

        // --- Multi-Speaker Generation ---
        if (finalSpeakers.length === 2) {
            const voiceMap = new Map<string, string>();
            
            // Assign voices based on a priority system to ensure consistency
            if (finalSpeakers.includes('NARRATOR')) {
                voiceMap.set('NARRATOR', 'Kore');
                const otherSpeaker = finalSpeakers.find(s => s !== 'NARRATOR')!;
                voiceMap.set(otherSpeaker, otherSpeaker === 'MALE' ? 'Puck' : 'Zephyr');
            } else if (finalSpeakers.includes('FEMALE_1') && finalSpeakers.includes('FEMALE_2')) {
                 voiceMap.set('FEMALE_1', 'Kore');
                 voiceMap.set('FEMALE_2', 'Zephyr');
            } else {
                // Generic fallback for any other 2-speaker combo
                const [first, second] = finalSpeakers;
                voiceMap.set(first, 'Kore');
                voiceMap.set(second, second === 'MALE' ? 'Puck' : 'Zephyr');
            }

            const speakerVoiceConfigs = finalSpeakers.map(speaker => ({
                speaker,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceMap.get(speaker)! } }
            }));
            
            const promptText = scriptForTts.map(chunk => `${chunk.speaker}: ${chunk.text}`).join('\n');
            
            response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: promptText }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        multiSpeakerVoiceConfig: { speakerVoiceConfigs }
                    }
                }
            });
        } 
        // --- Single-Speaker Generation ---
        else {
            const toneInstruction = await analyzeStoryTone(text);
            const promptText = toneInstruction
                ? `Leggi il seguente testo ${toneInstruction}: ${text}`
                : text;

            response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: promptText }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });
        }
        
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

// This function remains for the single-voice fallback logic.
export const analyzeStoryTone = async (story: string): Promise<string> => {
    try {
        const prompt = `Analizza il tono, l'atmosfera e il contenuto emotivo del seguente testo di una storia. In base alla tua analisi, restituisci una breve istruzione vocale per un narratore AI su come leggere il testo. Esempi: 'con un tono cupo e pieno di suspense', 'con voce meravigliata e sognante', 'in modo rapido e ansioso', 'con un senso di tranquilla malinconia'.

Restituisci SOLO l'istruzione, come testo semplice, senza virgolette o altre spiegazioni.

TESTO DELLA STORIA:
---
${story}
---`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.warn("Could not analyze story tone:", error);
        return ""; // Return empty string on failure to not break the audio generation
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
