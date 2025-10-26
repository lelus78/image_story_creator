import React, { useState, useRef, useCallback } from 'react';
import { generateStoryFromImage, textToSpeech, continueStory, suggestTitles, concludeStory } from '../services/geminiService';
import { UploadIcon, SparklesIcon, SpeakerIcon, LoadingSpinner, DownloadIcon, HtmlIcon, ContinueIcon, TitleIcon, ConcludeIcon } from './icons/FeatureIcons';

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
    
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size for PCM
    view.setUint16(20, 1, true); // AudioFormat for PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    return new Blob([view, pcmData], { type: 'audio/wav' });
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
  const [story, setStory] = useState<string | null>(null);
  const [titles, setTitles] = useState<string[] | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isReading, setIsReading] = useState<boolean>(false);
  const [isExportingHtml, setIsExportingHtml] = useState<boolean>(false);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState<boolean>(false);
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [isSuggestingTitles, setIsSuggestingTitles] = useState<boolean>(false);
  const [isConcluded, setIsConcluded] = useState<boolean>(false);
  const [continuationCount, setContinuationCount] = useState<number>(0);


  const [error, setError] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const resetStoryState = () => {
    setStory(null);
    setError(null);
    setGeneratedAudio(null);
    setTitles(null);
    setSelectedTitle(null);
    setContinuationCount(0);
    setIsConcluded(false);
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

  const handleGenerateStory = useCallback(async () => {
    if (!imageFile) return;

    setIsLoading(true);
    resetStoryState();

    try {
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const generatedStory = await generateStoryFromImage(base64Data, imageFile.type, theme, genre);
        setStory(generatedStory);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [imageFile, theme, genre]);
  
  const invalidateSecondaryContent = () => {
    setGeneratedAudio(null);
    setTitles(null);
    setSelectedTitle(null);
  };

  const handleAdvanceStory = useCallback(async () => {
    if (!story) return;

    setIsAdvancing(true);
    setError(null);
    try {
        let nextParagraph: string;
        if (continuationCount === 0) {
            nextParagraph = await continueStory(story);
            setContinuationCount(1);
        } else {
            nextParagraph = await concludeStory(story);
            setIsConcluded(true);
        }
        
        setStory(prevStory => (prevStory + '\n\n' + nextParagraph).trim());
        invalidateSecondaryContent();

    } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${continuationCount === 0 ? 'continue' : 'conclude'} the story.`);
    } finally {
        setIsAdvancing(false);
    }
  }, [story, continuationCount]);

  const handleSuggestTitles = useCallback(async () => {
    if (!story) return;

    setIsSuggestingTitles(true);
    setTitles(null);
    setSelectedTitle(null);
    setError(null);
    try {
        const suggestedTitles = await suggestTitles(story);
        setTitles(suggestedTitles);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred while suggesting titles.');
    } finally {
        setIsSuggestingTitles(false);
    }
  }, [story]);

  const handleReadAloud = useCallback(async () => {
    if (!story || isReading) return;

    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    
    setIsReading(true);
    setError(null);
    
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const audioContext = audioContextRef.current;
        await audioContext.resume();

        const base64Audio = generatedAudio || await textToSpeech(story);
        if (!generatedAudio) {
            setGeneratedAudio(base64Audio);
        }
        const audioBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => {
          setIsReading(false);
          audioSourceRef.current = null;
        };
        source.start();
        audioSourceRef.current = source;

    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to play audio.');
        setIsReading(false);
    }
}, [story, isReading, generatedAudio]);

  const handleExportHtml = async () => {
    if (!story || !image) return;

    setIsExportingHtml(true);
    setError(null);

    try {
        const audioB64 = generatedAudio || await textToSpeech(story);
        if (!generatedAudio) setGeneratedAudio(audioB64);
        const audioBytes = decode(audioB64);
        const wavBlob = createWavBlob(audioBytes, { sampleRate: 24000, numChannels: 1, bitsPerSample: 16 });
        const audioDataUri = await blobToBase64(wavBlob);
        const storyTitle = selectedTitle || (titles ? titles[0] : "AI Generated Story");

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
        p { white-space: pre-wrap; color: #d1d5db; }
        audio { width: 100%; margin-top: 2rem; }
    </style>
</head>
<body>
    <div class="container">
        <img src="${image}" alt="Inspiration Image">
        <h1>${storyTitle}</h1>
        <p>${story.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
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
    if (!story) return;
    setIsDownloadingAudio(true);
    setError(null);
    try {
      const audioToDownload = generatedAudio || await textToSpeech(story);
      if (!generatedAudio) setGeneratedAudio(audioToDownload);
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

  const isActionInProgress = isReading || isDownloadingAudio || isExportingHtml || isAdvancing || isSuggestingTitles;

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
          <button
            onClick={handleGenerateStory}
            disabled={!image || isLoading}
            className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-all duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100"
          >
            {isLoading ? <LoadingSpinner /> : <SparklesIcon />}
            {isLoading ? 'Generating...' : 'Generate Story'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
      
      {story && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mt-4 animate-fade-in">
          <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 h-8">
            {selectedTitle || 'The Beginning...'}
          </h2>
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{story}</p>
          
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
            <button onClick={handleSuggestTitles} disabled={isActionInProgress} className="inline-flex items-center gap-2 bg-teal-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-teal-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
              {isSuggestingTitles ? <LoadingSpinner /> : <TitleIcon />}
              {isSuggestingTitles ? 'Suggesting...' : 'Suggest Titles'}
            </button>
            {!isConcluded && (
                 <button onClick={handleAdvanceStory} disabled={isActionInProgress} className="inline-flex items-center gap-2 bg-teal-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-teal-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
                    {isAdvancing ? <LoadingSpinner /> : (continuationCount === 0 ? <ContinueIcon /> : <ConcludeIcon />)}
                    {isAdvancing ? (continuationCount === 0 ? 'Continuing...' : 'Concluding...') : (continuationCount === 0 ? 'Continue Story' : 'Conclude Story')}
                </button>
            )}
            <button onClick={handleReadAloud} disabled={isActionInProgress} className="inline-flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
              {isReading ? <LoadingSpinner /> : <SpeakerIcon />}
              {isReading ? 'Reading...' : 'Read Aloud'}
            </button>
            <button onClick={handleDownloadAudio} disabled={isActionInProgress} className="inline-flex items-center gap-2 bg-sky-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-sky-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
              {isDownloadingAudio ? <LoadingSpinner /> : <DownloadIcon />}
              {isDownloadingAudio ? 'Preparing...' : 'Download Audio'}
            </button>
            <button onClick={handleExportHtml} disabled={isActionInProgress} className="inline-flex items-center gap-2 bg-purple-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-purple-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
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