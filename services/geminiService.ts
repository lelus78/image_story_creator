import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ChatMessage } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generateStoryFromImage = async (imageData: string, mimeType: string, theme?: string, genre?: string): Promise<string> => {
  try {
    const imagePart = {
      inlineData: {
        data: imageData,
        mimeType: mimeType,
      },
    };

    const genreText = genre && genre.trim() !== '' ? `di genere ${genre}` : 'fantasy o di fantascienza';
    let promptText = `Usa questa immagine come ispirazione. Scrivi un'apertura di storia breve e potente in italiano (massimo due paragrafi). Non limitarti a descrivere la scena o i sentimenti. Invece, crea un mini-arco narrativo che contenga obbligatoriamente questi tre elementi:
1.  **L'Azione:** Un personaggio compie un'azione significativa con uno scopo chiaro ma misterioso (es. suonare una melodia come un rituale, attendere qualcuno, cercare un oggetto).
2.  **L'Evento:** Un evento tangibile e specifico che interrompe o è il risultato diretto dell'azione. Deve essere un dettaglio sensoriale forte (es. una corrente d'aria gelida spegne le candele, un libro cade da uno scaffale, un sussurro si sente nel silenzio).
3.  **La Reazione o il Testimone:** La reazione immediata del personaggio all'evento (es. si ferma di scatto e fissa un punto, sussurra un nome) OPPURE l'introduzione di un testimone che osserva la scena di nascosto.

Il tono deve creare tensione e mistero immediati. La prosa deve essere impeccabile, ricca e fluida.`
    
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

export const continueStory = async (existingStory: string): Promise<string> => {
  try {
    const prompt = `Sei un maestro della narrativa. Continua la seguente storia, che già contiene un evento scatenante. Il tuo compito è far escalare la tensione e svelare di più sul mistero, portando la storia al suo climax. **Non ripetere l'impostazione iniziale.**

Concentrati sulle **conseguenze dirette** dell'evento accaduto. Cosa succede immediatamente dopo? Scegli **una** di queste direzioni:
1.  **Il Testimone Reagisce:** Descrivi le azioni, i pensieri o le paure del personaggio che ha assistito all'evento. Si rivela? Scappa? Cerca di capire cosa sta succedendo?
2.  **La "Presenza" si Intensifica:** L'evento iniziale era solo un assaggio. Descrivi una seconda manifestazione, più chiara e significativa. La corrente d'aria diventa una voce, l'oggetto caduto rivela un messaggio nascosto.
3.  **Il Protagonista Agisce:** Ora che il suo rituale ha avuto effetto, qual è la prossima mossa deliberata del protagonista? Si rivolge alla presenza? Si muove verso la fonte del disturbo? La sua reazione deve far avanzare la trama.

Sviluppa la direzione scelta in un paragrafo teso e avvincente.

STORIA FINORA:
${existingStory}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error continuing story:", error);
    throw new Error("Failed to continue the story. Please try again.");
  }
};

export const concludeStory = async (existingStory: string): Promise<string> => {
  try {
    const prompt = `Sei un maestro della narrativa, incaricato di concludere una storia. Il testo che segue è arrivato al suo punto di massima tensione. Il tuo compito è scrivere il **paragrafo finale**, fornendo una risoluzione soddisfacente e conclusiva.

**Non introdurre nuovi misteri o domande.** Devi chiudere la narrazione.
- **Rispondi al mistero centrale:** Chi o cosa era la "presenza"? Qual era lo scopo finale del protagonista?
- **Descrivi l'esito finale:** Cosa accade al protagonista e alla presenza? Si riuniscono? C'è una rivelazione? La missione è compiuta o fallita?
- **Crea un finale d'impatto:** Lascia il lettore con un'emozione forte (tristezza, pace, stupore, inquietudine) che sia coerente con il tono della storia.

Scrivi un paragrafo finale che leghi tutti i fili e dia un senso di completezza.

STORIA FINORA:
${existingStory}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error concluding story:", error);
    throw new Error("Failed to conclude the story. Please try again.");
  }
};

export const suggestTitles = async (story: string): Promise<string[]> => {
    try {
        const prompt = `Dato il seguente testo di una storia, suggerisci 5 titoli accattivanti. I titoli devono essere creativi e riflettere il tono e il contenuto della storia.\n\nTESTO:\n${story}`;

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