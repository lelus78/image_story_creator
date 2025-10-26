import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateStoryFromImage, textToSpeech, continueStory, suggestTitles, concludeStory, regenerateChunk, regenerateParagraph } from '../services/geminiService';
import { UploadIcon, SparklesIcon, SpeakerIcon, LoadingSpinner, DownloadIcon, HtmlIcon, ContinueIcon, TitleIcon, ConcludeIcon, RegenerateIcon, HintIcon, PlayIcon, PauseIcon, StopIcon, CancelIcon } from './icons/FeatureIcons';

// Audio decoding utilities
const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

// WAV file creation utilities
const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
};

const createWavBlob = (pcmData: Uint8Array, options: { sampleRate: number, numChannels: number, bitsPerSample: number }): Blob => {
    const { sampleRate, numChannels, bitsPerSample } = options;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Write PCM data
    for (let i = 0; i < pcmData.length; i++) {
        view.setUint8(44 + i, pcmData[i]);
    }

    return new Blob([view], { type: 'audio/wav' });
};

// Blob to Base64 converter
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const StoryGenerator: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [theme, setTheme] = useState<string>('');
  const [genre, setGenre] = useState<string>('Fantasy');
  const [storyParts, setStoryParts] = useState<string[][] | null>(null);
  const [titles, setTitles] = useState<string[] | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExportingHtml, setIsExportingHtml] = useState<boolean>(false);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState<boolean>(false);
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [isSuggestingTitles, setIsSuggestingTitles] = useState<boolean>(false);
  
  const [regeneratingIndex, setRegeneratingIndex] = useState<{ p: number; c: number } | null>(null);
  const [editingHintFor, setEditingHintFor] = useState<{ p: number; c: number } | null>(null);
  const [regeneratingParagraph, setRegeneratingParagraph] = useState<number | null>(null);
  const [editingHintForParagraph, setEditingHintForParagraph] = useState<number | null>(null);
  const [hintText, setHintText] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);

  // Audio Playback State
  const [playbackState, setPlaybackState] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const generationAbortControllerRef = useRef<AbortController | null>(null);
  
  // Cleanup audio resources on unmount
  useEffect(() => {
    return () => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
    };
  }, []);

  const getFullStoryText = useCallback(() => {
    return storyParts ? storyParts.map(p => p.join(' ')).join('\n\n') : '';
  }, [storyParts]);

  const handleStopPlayback = useCallback(() => {
    if (audioSourceRef.current) {
        audioSourceRef.current.onended = null; // Prevent onended from firing
        try { audioSourceRef.current.stop(); } catch(e) {}
        audioSourceRef.current = null;
    }
    setPlaybackState('stopped');
    pauseOffsetRef.current = 0;
  }, []);

  const resetStoryState = () => {
    setStoryParts(null);
    setError(null);
    handleStopPlayback();
    setGeneratedAudio(null);
    audioBufferRef.current = null;
    setTitles(null);
    setSelectedTitle(null);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        resetStoryState();
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleCancelGeneration = () => {
    if (generationAbortControllerRef.current) {
        generationAbortControllerRef.current.abort();
        generationAbortControllerRef.current = null;
        setIsLoading(false);
        setError("Story generation cancelled.");
    }
  };

  const handleGenerateStory = useCallback(async () => {
    if (!imageFile) return;
    
    handleCancelGeneration(); // Cancel any previous one
    const controller = new AbortController();
    generationAbortControllerRef.current = controller;

    setIsLoading(true);
    resetStoryState();

    try {
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onloadend = async () => {
        try {
            if (controller.signal.aborted) return;
            const base64Data = (reader.result as string).split(',')[1];
            const generatedParagraph = await generateStoryFromImage(base64Data, imageFile.type, genre, theme);
            if (controller.signal.aborted) return;
            setStoryParts([generatedParagraph]);
        } catch (err) {
            if (!controller.signal.aborted) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            }
        } finally {
             if (generationAbortControllerRef.current === controller) {
                setIsLoading(false);
                generationAbortControllerRef.current = null;
            }
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setIsLoading(false);
      generationAbortControllerRef.current = null;
    }
  }, [imageFile, theme, genre]);
  
  const invalidateSecondaryContent = () => {
    handleStopPlayback();
    setGeneratedAudio(null);
    audioBufferRef.current = null;
    setTitles(null);
    setSelectedTitle(null);
  };

  const handleAdvanceStory = useCallback(async () => {
    if (!storyParts || storyParts.length === 0) return;

    setIsAdvancing(true);
    setError(null);
    try {
        const currentStory = getFullStoryText();
        let nextParagraph: string[];

        if (storyParts.length === 1) {
            nextParagraph = await continueStory(currentStory, genre);
        } else {
            nextParagraph = await concludeStory(currentStory, genre);
        }
        
        setStoryParts(prevStory => [...(prevStory || []), nextParagraph]);
        invalidateSecondaryContent();

    } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to advance the story.`);
    } finally {
        setIsAdvancing(false);
    }
  }, [storyParts, getFullStoryText, genre]);

 const handleRegenerateChunk = useCallback(async (pIndex: number, cIndex: number, hint?: string) => {
    if (!storyParts) return;

    setRegeneratingIndex({ p: pIndex, c: cIndex });
    if (editingHintFor) setEditingHintFor(null);
    setError(null);

    try {
        const paragraphContext = storyParts[pIndex].join(' ');
        const chunkToRegenerate = storyParts[pIndex][cIndex];

        const newChunk = await regenerateChunk(paragraphContext, chunkToRegenerate, hint);

        setStoryParts(prev => {
            if (!prev) return null;
            const newStoryParts = prev.map(p => [...p]);
            newStoryParts[pIndex][cIndex] = newChunk;
            return newStoryParts;
        });
        invalidateSecondaryContent();

    } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to regenerate part.`);
    } finally {
        setRegeneratingIndex(null);
        setHintText('');
    }
}, [storyParts, editingHintFor]);

 const handleRegenerateParagraph = useCallback(async (pIndex: number, hint?: string) => {
    if (!storyParts) return;

    setRegeneratingParagraph(pIndex);
    if (editingHintForParagraph !== null) setEditingHintForParagraph(null);
    setError(null);

    try {
        const storyContext = {
            before: storyParts.slice(0, pIndex).map(p => p.join(' ')).join('\n\n'),
            after: storyParts.slice(pIndex + 1).map(p => p.join(' ')).join('\n\n')
        };
        const paragraphToRegenerate = storyParts[pIndex].join(' ');

        const newParagraph = await regenerateParagraph(storyContext, paragraphToRegenerate, hint);

        setStoryParts(prev => {
            if (!prev) return null;
            const newStoryParts = prev.map(p => [...p]);
            newStoryParts[pIndex] = newParagraph;
            return newStoryParts;
        });
        invalidateSecondaryContent();

    } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to regenerate paragraph.`);
    } finally {
        setRegeneratingParagraph(null);
        setHintText('');
    }
}, [storyParts, editingHintForParagraph]);


  const handleSuggestTitles = useCallback(async () => {
    if (!storyParts) return;

    setIsSuggestingTitles(true);
    setTitles(null);
    setSelectedTitle(null);
    setError(null);
    try {
        const fullStory = getFullStoryText();
        const suggestedTitles = await suggestTitles(fullStory);
        setTitles(suggestedTitles);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred while suggesting titles.');
    } finally {
        setIsSuggestingTitles(false);
    }
  }, [storyParts, getFullStoryText]);

  const getOrGenerateAudio = useCallback(async (): Promise<string> => {
    if (generatedAudio) {
        return generatedAudio;
    }
    const fullStory = getFullStoryText();
    if (!fullStory) throw new Error("Story is empty.");
    
    const base64Audio = await textToSpeech(fullStory);
    setGeneratedAudio(base64Audio);
    return base64Audio;
  }, [generatedAudio, getFullStoryText]);


  const handlePlaybackControls = useCallback(async () => {
    setError(null);
    // Handle PAUSE
    if (playbackState === 'playing') {
        if (audioSourceRef.current && audioContextRef.current) {
            pauseOffsetRef.current += audioContextRef.current.currentTime - playbackStartTimeRef.current;
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
        }
        setPlaybackState('paused');
        return;
    }

    // Handle PLAY or RESUME
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        await audioContextRef.current.resume();

        // If starting from scratch or audio is invalidated, load it
        if (!audioBufferRef.current) {
            setIsAudioLoading(true);
            const base64Audio = await getOrGenerateAudio();
            const audioBytes = decode(base64Audio);
            audioBufferRef.current = await decodeAudioData(audioBytes, audioContextRef.current, 24000, 1);
            setIsAudioLoading(false);
        }

        const audioContext = audioContextRef.current;
        const source = audioContext.createBufferSource();
        source.buffer = audioBufferRef.current;
        source.connect(audioContext.destination);
        source.onended = () => {
            // Only set to stopped if it wasn't manually stopped or paused
            if (audioSourceRef.current === source) {
                handleStopPlayback();
            }
        };

        playbackStartTimeRef.current = audioContext.currentTime;
        source.start(0, pauseOffsetRef.current % source.buffer.duration);
        
        audioSourceRef.current = source;
        setPlaybackState('playing');

    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to play audio.');
        setIsAudioLoading(false);
        handleStopPlayback();
    }
  }, [playbackState, getOrGenerateAudio, handleStopPlayback]);


  const handleExportHtml = async () => {
    if (!getFullStoryText() || !image) return;

    setIsExportingHtml(true);
    setError(null);

    try {
        const audioB64 = await getOrGenerateAudio();
        const audioBytes = decode(audioB64);
        const wavBlob = createWavBlob(audioBytes, { sampleRate: 24000, numChannels: 1, bitsPerSample: 16 });
        const audioDataUri = await blobToBase64(wavBlob);
        const storyTitle = selectedTitle || (titles ? titles[0] : "AI Generated Story");

        const storyHtml = storyParts?.map(p => `<p>${p.map(chunk => chunk.replace(/</g, "&lt;").replace(/>/g, "&gt;")).join(' ')}</p>`).join('') || '';

        const pageHtml = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${storyTitle}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; background-color: #111827; color: #f3f4f6; margin: 0; padding: 2rem; }
        .container { max-width: 800px; margin: 0 auto; background-color: #1f2937; border-radius: 0.75rem; padding: 2rem; border: 1px solid #374151; }
        img { max-width: 100%; border-radius: 0.5rem; margin-bottom: 1.5rem; }
        h1 { color: #a5b4fc; font-size: 1.875rem; margin-bottom: 1rem; }
        p { color: #d1d5db; margin-bottom: 1em; }
        audio { width: 100%; margin-top: 2rem; }
    </style>
</head>
<body>
    <div class="container">
        <img src="${image}" alt="Inspiration Image">
        <h1>${storyTitle}</h1>
        ${storyHtml}
        <audio controls src="${audioDataUri}">Your browser does not support the audio element.</audio>
    </div>
</body>
</html>`;

        const htmlBlob = new Blob([pageHtml], { type: 'text/html' });
        const url = URL.createObjectURL(htmlBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai-story.html';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to export HTML page.');
    } finally {
        setIsExportingHtml(false);
    }
  };

  const handleDownloadAudio = async () => {
    if (!getFullStoryText()) return;
    setIsDownloadingAudio(true);
    setError(null);
    try {
      const audioToDownload = await getOrGenerateAudio();
      const audioBytes = decode(audioToDownload);
      const wavBlob = createWavBlob(audioBytes, { sampleRate: 24000, numChannels: 1, bitsPerSample: 16 });
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'story-audio.wav';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download audio.');
    } finally {
      setIsDownloadingAudio(false);
    }
  };

  const isActionInProgress = isLoading || isAudioLoading || isDownloadingAudio || isExportingHtml || isAdvancing || isSuggestingTitles || regeneratingIndex !== null || regeneratingParagraph !== null;
  const isConcluded = storyParts && storyParts.length >= 3;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <label htmlFor="image-upload" className="cursor-pointer">
            <div id="story-image-container" className="relative border-2 border-dashed border-gray-500 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors duration-200 h-64 md:h-full flex flex-col justify-center items-center bg-gray-900/50">
              {image ? (
                <img src={image} alt="Upload preview" className="max-h-full max-w-full object-contain rounded-md" />
              ) : (
                <>
                  <UploadIcon />
                  <p className="mt-2 text-gray-400">Click to upload an image</p>
                  <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
                </>
              )}
            </div>
          </label>
          <input id="image-upload" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <h2 className="text-2xl font-semibold mb-4 text-indigo-300">Your Story's Canvas</h2>
          <p className="text-gray-400 mb-4">Upload an image, choose a genre, and let our AI ghostwriter craft a captivating opening for you.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
             <div>
                <label htmlFor="story-genre" className="block text-sm font-medium text-gray-300 mb-2">Genre</label>
                <select id="story-genre" value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow">
                    <option>Fantasy</option>
                    <option>Sci-Fi</option>
                    <option>Horror</option>
                    <option>Mystery</option>
                    <option>Romance</option>
                </select>
            </div>
            <div>
                <label htmlFor="story-theme" className="block text-sm font-medium text-gray-300 mb-2">Theme (optional)</label>
                <input id="story-theme" type="text" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g., a lost artifact" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"/>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateStory}
              disabled={!image || isLoading}
              className="flex items-center justify-center gap-2 flex-grow bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-all duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100"
            >
              {isLoading ? <LoadingSpinner /> : <SparklesIcon />}
              {isLoading ? 'Generating...' : 'Generate Story'}
            </button>
            {isLoading && (
                <button 
                    onClick={handleCancelGeneration} 
                    className="flex-shrink-0 bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200"
                    title="Cancel Generation"
                >
                    <CancelIcon />
                </button>
            )}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
      
      {storyParts && storyParts.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mt-4 animate-fade-in">
          <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 h-8">
            {selectedTitle || 'The Beginning...'}
          </h2>
          
          <div className="space-y-4">
            {storyParts.map((paragraph, pIndex) => (
                <div key={pIndex} className="relative group/paragraph">
                    {regeneratingParagraph === pIndex && (
                        <div className="absolute inset-0 bg-gray-800/70 flex items-center justify-center rounded-lg z-30">
                            <LoadingSpinner />
                        </div>
                    )}
                     <div className="absolute top-0 right-0 z-20 hidden group-hover/paragraph:flex bg-gray-900/70 backdrop-blur-sm p-1 rounded-bl-lg rounded-tr-lg">
                        <button 
                            onClick={() => handleRegenerateParagraph(pIndex)}
                            disabled={isActionInProgress}
                            className="p-1 rounded-full hover:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                            title="Regenerate Paragraph"
                        >
                            <RegenerateIcon />
                        </button>
                        <button 
                            onClick={() => {
                                setEditingHintForParagraph(editingHintForParagraph === pIndex ? null : pIndex);
                                setEditingHintFor(null);
                            }}
                            disabled={isActionInProgress}
                            className={`p-1 rounded-full hover:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors ${editingHintForParagraph === pIndex ? 'bg-indigo-600 text-white' : ''}`}
                            title="Regenerate Paragraph with hint"
                        >
                            <HintIcon />
                        </button>
                    </div>

                    {editingHintForParagraph === pIndex && (
                        <div className="absolute top-8 right-0 z-20 w-64 bg-gray-700 p-2 rounded-lg shadow-lg flex gap-2">
                            <input
                                type="text"
                                autoFocus
                                value={hintText}
                                onChange={(e) => setHintText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleRegenerateParagraph(pIndex, hintText)}}
                                placeholder="Suggerimento per paragrafo..."
                                className="flex-1 bg-gray-600 border border-gray-500 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            <button
                                onClick={() => handleRegenerateParagraph(pIndex, hintText)}
                                className="bg-indigo-600 text-white font-bold py-1 px-2 rounded-md text-sm hover:bg-indigo-700"
                            >
                                Invia
                            </button>
                        </div>
                    )}


                    <p className="text-gray-300 leading-relaxed">
                        {paragraph.map((chunk, cIndex) => {
                             const isRegenerating = regeneratingIndex?.p === pIndex && regeneratingIndex?.c === cIndex;
                             const isEditingHint = editingHintFor?.p === pIndex && editingHintFor?.c === cIndex;

                             return (
                                <span key={cIndex} className="inline-block relative group/chunk pr-2">
                                    {isRegenerating ? (
                                        <span className="text-indigo-400 animate-pulse">...</span>
                                    ) : (
                                        <span className={`transition-colors duration-200 ${isEditingHint ? 'bg-indigo-900/50' : 'group-hover/chunk:bg-gray-700/75'}`}>{chunk}</span>
                                    )}
                                    {' '}
                                    <div className="absolute top-0 -right-1 h-full items-center z-10 hidden group-hover/chunk:flex bg-gray-800 pl-1">
                                        {!isRegenerating && (
                                            <>
                                            <button 
                                                onClick={() => handleRegenerateChunk(pIndex, cIndex)}
                                                disabled={isActionInProgress}
                                                className="p-1 rounded-full hover:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                                                title="Regenerate"
                                            >
                                                <RegenerateIcon />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setEditingHintFor(isEditingHint ? null : {p: pIndex, c: cIndex});
                                                    setEditingHintForParagraph(null);
                                                }}
                                                disabled={isActionInProgress}
                                                className={`p-1 rounded-full hover:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors ${isEditingHint ? 'bg-indigo-600 text-white' : ''}`}
                                                title="Regenerate with hint"
                                            >
                                                <HintIcon />
                                            </button>
                                            </>
                                        )}
                                    </div>
                                    {isEditingHint && (
                                        <div className="absolute top-full left-0 mt-2 z-20 w-64 bg-gray-700 p-2 rounded-lg shadow-lg flex gap-2">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={hintText}
                                                onChange={(e) => setHintText(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleRegenerateChunk(pIndex, cIndex, hintText)}}
                                                placeholder="Il tuo suggerimento..."
                                                className="flex-1 bg-gray-600 border border-gray-500 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                            />
                                            <button
                                                onClick={() => handleRegenerateChunk(pIndex, cIndex, hintText)}
                                                className="bg-indigo-600 text-white font-bold py-1 px-2 rounded-md text-sm hover:bg-indigo-700"
                                            >
                                                Invia
                                            </button>
                                        </div>
                                    )}
                                </span>
                            );
                        })}
                    </p>
                </div>
            ))}
           </div>
          
          {titles && (
            <div className="mt-6 bg-gray-900/50 p-4 rounded-lg border border-gray-600">
                <h4 className="text-lg font-semibold mb-3 text-indigo-400">Click a title to apply it:</h4>
                <ul className="space-y-1">
                    {titles.map((title, index) => (
                        <li key={index}>
                            <button 
                                onClick={() => setSelectedTitle(title)}
                                className={`w-full text-left p-2 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                                    selectedTitle === title 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'text-gray-300 hover:bg-indigo-700/50 hover:text-white'
                                }`}
                            >
                                <span className="font-semibold mr-2">&#8227;</span>{title}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-4 justify-end">
            <button onClick={handleSuggestTitles} disabled={isActionInProgress || playbackState !== 'stopped'} className="inline-flex items-center gap-2 bg-teal-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-teal-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
              {isSuggestingTitles ? <LoadingSpinner /> : <TitleIcon />}
              {isSuggestingTitles ? 'Suggesting...' : 'Suggest Titles'}
            </button>
            {!isConcluded && (
                 <button onClick={handleAdvanceStory} disabled={isActionInProgress || playbackState !== 'stopped'} className="inline-flex items-center gap-2 bg-teal-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-teal-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
                    {isAdvancing ? <LoadingSpinner /> : (storyParts.length < 2 ? <ContinueIcon /> : <ConcludeIcon />)}
                    {isAdvancing ? (storyParts.length < 2 ? 'Continuing...' : 'Concluding...') : (storyParts.length < 2 ? 'Continue Story' : 'Conclude Story')}
                </button>
            )}
            
            <button onClick={handlePlaybackControls} disabled={isActionInProgress || isAudioLoading} className="inline-flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
              {isAudioLoading ? <LoadingSpinner /> : (playbackState === 'playing' ? <PauseIcon /> : (playbackState === 'paused' ? <PlayIcon /> : <SpeakerIcon />) )}
              {isAudioLoading ? 'Loading...' : (playbackState === 'playing' ? 'Pause' : (playbackState === 'paused' ? 'Resume' : 'Read Aloud'))}
            </button>
            {playbackState !== 'stopped' && (
                 <button onClick={handleStopPlayback} className="inline-flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-red-700 transition-colors duration-200">
                    <StopIcon />
                    Stop
                </button>
            )}

            <button onClick={handleDownloadAudio} disabled={isActionInProgress || playbackState !== 'stopped'} className="inline-flex items-center gap-2 bg-sky-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-sky-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
              {isDownloadingAudio ? <LoadingSpinner /> : <DownloadIcon />}
              {isDownloadingAudio ? 'Preparing...' : 'Download Audio'}
            </button>
            <button onClick={handleExportHtml} disabled={isActionInProgress || playbackState !== 'stopped'} className="inline-flex items-center gap-2 bg-purple-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-purple-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
              {isExportingHtml ? <LoadingSpinner /> : <HtmlIcon />}
              {isExportingHtml ? 'Exporting...' : 'Export HTML'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryGenerator;