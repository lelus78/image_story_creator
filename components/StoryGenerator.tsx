import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateStoryFromImage, textToSpeech, continueStory, suggestTitles, concludeStory, regenerateChunk, regenerateParagraph, refineStory } from '../services/geminiService';
import { UploadIcon, SparklesIcon, SpeakerIcon, LoadingSpinner, DownloadIcon, HtmlIcon, ContinueIcon, TitleIcon, ConcludeIcon, RegenerateIcon, HintIcon, PlayIcon, PauseIcon, StopIcon, CancelIcon, RefineIcon } from './icons/FeatureIcons';

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

const getThemeCss = (genre: string): string => {
    switch (genre) {
        case 'Sci-Fi':
            return `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Roboto+Mono&display=swap');
        body { font-family: 'Roboto Mono', monospace; line-height: 1.7; background-color: #0c0c1e; color: #a7d1d2; margin: 0; padding: 2rem; background-image: radial-gradient(circle at top right, rgba(0, 229, 255, 0.15), transparent 50%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%230e2030' fill-opacity='0.4'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.41l-2.83 2.83-1.41-1.41L38.59 0H40v1.41zM20 18.6l2.83-2.83 1.41 1.41L21.41 20l2.83 2.83-1.41 1.41L20 21.41l-2.83 2.83-1.41-1.41L18.59 20l-2.83-2.83 1.41-1.41L20 18.59z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }
        .container { max-width: 800px; margin: 0 auto; background-color: rgba(10, 25, 47, 0.8); border-radius: 0.75rem; padding: 2.5rem; border: 1px solid #00e5ff; box-shadow: 0 0 20px rgba(0, 229, 255, 0.3); backdrop-filter: blur(5px); }
        img { max-width: 100%; border-radius: 0.5rem; margin-bottom: 1.5rem; border: 2px solid #00a1b5; }
        h1 { font-family: 'Orbitron', sans-serif; color: #00e5ff; font-size: 2rem; margin-bottom: 1rem; text-shadow: 0 0 10px #00e5ff; }
        p { color: #d1d5db; margin-bottom: 1em; }
        audio { width: 100%; margin-top: 2rem; filter: hue-rotate(180deg) brightness(1.2); }`;
        case 'Horror':
            return `
        @import url('https://fonts.googleapis.com/css2?family=Creepster&family=EB+Garamond&display=swap');
        body { font-family: 'EB Garamond', serif; line-height: 1.6; background-color: #000000; color: #cccccc; margin: 0; padding: 2rem; background-image: radial-gradient(circle, transparent, #000 80%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill='%232c0000' fill-opacity='0.2'%3E%3Cpath fill-rule='evenodd' d='M11 0l5 20-5-5-5 5L11 0zM31 0l5 20-5-5-5 5L31 0zM51 0l5 20-5-5-5 5L51 0zM71 0l5 20-5-5-5 5L71 0zM91 0l5 20-5-5-5 5L91 0zM11 100l5-20-5 5-5-5L11 100zM31 100l5-20-5 5-5-5L31 100zM51 100l5-20-5 5-5-5L51 100zM71 100l5-20-5 5-5-5L71 100zM91 100l5-20-5 5-5-5L91 100zM0 11l20 5-5-5-5-5L0 11zM0 31l20 5-5-5-5-5L0 31zM0 51l20 5-5-5-5-5L0 51zM0 71l20 5-5-5-5-5L0 71zM0 91l20 5-5-5-5-5L0 91zM100 11l-20 5 5-5 5-5L100 11zM100 31l-20 5 5-5 5-5L100 31zM100 51l-20 5 5-5 5-5L100 51zM100 71l-20 5 5-5 5-5L100 71zM100 91l-20 5 5-5 5-5L100 91z'/%3E%3C/g%3E%3C/svg%3E"); }
        .container { max-width: 700px; margin: 0 auto; background-color: #100000; border-radius: 0.25rem; padding: 2rem; border: 1px solid #660000; box-shadow: inset 0 0 15px #000; }
        img { max-width: 100%; border-radius: 0.25rem; margin-bottom: 1.5rem; filter: grayscale(80%) contrast(1.2); }
        h1 { font-family: 'Creepster', cursive; color: #b90000; font-size: 2.5rem; letter-spacing: 2px; margin-bottom: 1rem; text-shadow: 0 0 5px #ff0000; }
        p { color: #a0a0a0; margin-bottom: 1em; }
        audio { width: 100%; margin-top: 2rem; }`;
        case 'Mystery':
            return `
        @import url('https://fonts.googleapis.com/css2?family=Special+Elite&display=swap');
        body { font-family: 'Special Elite', monospace; line-height: 1.8; background-color: #3d352a; color: #1a1815; margin: 0; padding: 2rem; background-image: radial-gradient(ellipse at center, rgba(253, 246, 227, 0.1) 0%, transparent 70%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%239C92AC' fill-opacity='0.05' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E"); }
        .container { max-width: 800px; margin: 0 auto; background-color: #fdf6e3; border-radius: 0; padding: 3rem; border: 1px solid #d3c2a6; box-shadow: 0 5px 15px rgba(0,0,0,0.4); }
        img { max-width: 100%; border-radius: 0; margin-bottom: 1.5rem; filter: sepia(0.7) contrast(1.1) brightness(0.9); }
        h1 { color: #585040; font-size: 2rem; margin-bottom: 1.5rem; text-align: center; border-bottom: 2px solid #bda888; padding-bottom: 0.5rem; }
        p { color: #3d3830; margin-bottom: 1em; text-align: justify; }
        audio { width: 100%; margin-top: 2rem; }`;
        case 'Romance':
            return `
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Lato&display=swap');
        body { font-family: 'Lato', sans-serif; line-height: 1.7; background: linear-gradient(135deg, #fce3ec 0%, #fde4e4 50%, #e6e9f9 100%); color: #5c3740; margin: 0; padding: 2rem; }
        .container { max-width: 750px; margin: 0 auto; background-color: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border-radius: 1rem; padding: 2.5rem; border: 1px solid #f2dbe0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
        img { max-width: 100%; border-radius: 0.75rem; margin-bottom: 1.5rem; }
        h1 { font-family: 'Dancing Script', cursive; color: #d6336c; font-size: 2.8rem; text-align: center; margin-bottom: 1.5rem; }
        p { color: #6d4b53; margin-bottom: 1em; }
        audio { width: 100%; margin-top: 2rem; }`;
        case 'Adventure':
             return `
        @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=Merriweather&display=swap');
        body { font-family: 'Merriweather', serif; line-height: 1.7; background-color: #f5f1e9; color: #3a2e1d; margin: 0; padding: 2rem; background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NkY4Q0Q3QjE3RDdDMTFFN0FBN0VDMDI4Njc0RTBDOTAiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NkY4Q0Q3QjI3RDdDMTFFN0FBN0VDMDI4Njc0RTBDOTAiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo2RjhDRDdBRjdEN0MxMUU3QUE3RUMwMjg2NzRFMEM5MCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo2RjhDRDdCMDBEN0MxMUU3QUE3RUMwMjg2NzRFMEM5MCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wYWNrZXQ+IDw/eHBhY2tldCBlbmQ9InIiPz6aJ2VlAAAAsUlEQVR42uzasQ3CQAxA0U6EaNS0QZlo0sQYxY3oUM3CRk3K/QkCwfE47sE/kO9iJ7uXmUwm828GAA+gC3AC3MM3gA7gE/QBbsBPAM/zB3ADrIB2gA/AGrABHoAEeAOWwCzYAb4AUwAnwAVwDRwD34CXwI+ABPAEtAGCwIvgS/An0BsoBF4E/gStAn8C3wL/An8CPwI/Am+BjcAPwb/Bj8CzwI/Au8CXwE5gJ7A3sDeYyWSy+wswAF+e1e/g9N5lAAAAAElFTkSuQmCC"); }
        .container { max-width: 800px; margin: 0 auto; background-color: #e8e2d4; border-radius: 0.5rem; padding: 2.5rem; border: 3px solid #8c785d; box-shadow: 0 0 20px rgba(0,0,0,0.2); }
        img { max-width: 100%; border-radius: 0.25rem; margin-bottom: 1.5rem; border: 1px solid #c5b8a3; }
        h1 { font-family: 'IM Fell English SC', serif; color: #6b4f2c; font-size: 2.5rem; text-align: center; margin-bottom: 1.5rem; }
        p { color: #4a3c2a; margin-bottom: 1em; }
        audio { width: 100%; margin-top: 2rem; }`;
        case 'Thriller':
             return `
        @import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@700&family=Open+Sans&display=swap');
        body { font-family: 'Open Sans', sans-serif; line-height: 1.6; background-color: #111; color: #e5e5e5; margin: 0; padding: 2rem; background-image: linear-gradient(45deg, #222 25%, transparent 25%, transparent 75%, #222 75%, #222), linear-gradient(45deg, #222 25%, transparent 25%, transparent 75%, #222 75%, #222); background-size: 60px 60px; background-position: 0 0, 30px 30px; }
        .container { max-width: 800px; margin: 0 auto; background-color: #1a1a1a; border-radius: 0; padding: 2rem; border-left: 5px solid #ffc700; }
        img { max-width: 100%; border-radius: 0; margin-bottom: 1.5rem; filter: grayscale(100%) contrast(1.3); }
        h1 { font-family: 'Roboto Condensed', sans-serif; color: #ffc700; font-size: 2.2rem; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 1rem; }
        p { color: #c0c0c0; margin-bottom: 1em; }
        audio { width: 100%; margin-top: 2rem; }`;
        case 'Humor':
             return `
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700&family=Nunito&display=swap');
        body { font-family: 'Nunito', sans-serif; line-height: 1.6; background-color: #e0f7fa; color: #333; margin: 0; padding: 2rem; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cg fill='%2300aaff' fill-opacity='0.1'%3E%3Ccircle cx='10' cy='10' r='10'/%3E%3C/g%3E%3C/svg%3E"); }
        .container { max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 1rem; padding: 2rem; border: 2px solid #00aaff; }
        img { max-width: 100%; border-radius: 0.75rem; margin-bottom: 1.5rem; }
        h1 { font-family: 'Poppins', sans-serif; color: #ff6347; font-size: 2.3rem; text-align: center; margin-bottom: 1rem; }
        p { color: #4f4f4f; margin-bottom: 1em; }
        audio { width: 100%; margin-top: 2rem; }`;
        default: // Fantasy theme as default
            return `
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; background: #090a0f; background: radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%); color: #f3f4f6; margin: 0; padding: 2rem; }
        .container { max-width: 800px; margin: 0 auto; background-color: rgba(31, 41, 55, 0.7); backdrop-filter: blur(5px); border-radius: 0.75rem; padding: 2rem; border: 1px solid #374151; }
        img { max-width: 100%; border-radius: 0.5rem; margin-bottom: 1.5rem; }
        h1 { color: #a5b4fc; font-size: 1.875rem; margin-bottom: 1rem; }
        p { color: #d1d5db; margin-bottom: 1em; }
        audio { width: 100%; margin-top: 2rem; }`;
    }
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
  const [isRefining, setIsRefining] = useState<boolean>(false);
  
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
        setError("Generazione della storia annullata.");
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
                setError(err instanceof Error ? err.message : 'Si è verificato un errore sconosciuto.');
            }
        } finally {
             if (generationAbortControllerRef.current === controller) {
                setIsLoading(false);
                generationAbortControllerRef.current = null;
            }
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Si è verificato un errore sconosciuto.');
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
        setError(err instanceof Error ? err.message : `Impossibile far avanzare la storia.`);
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
        setError(err instanceof Error ? err.message : `Impossibile rigenerare la parte.`);
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
        setError(err instanceof Error ? err.message : `Impossibile rigenerare il paragrafo.`);
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
        setError(err instanceof Error ? err.message : 'Si è verificato un errore durante il suggerimento dei titoli.');
    } finally {
        setIsSuggestingTitles(false);
    }
  }, [storyParts, getFullStoryText]);

  const handleRefineStory = useCallback(async () => {
    if (!storyParts) return;

    setIsRefining(true);
    setError(null);
    try {
        const currentStory = getFullStoryText();
        const refinedStoryParts = await refineStory(currentStory);
        
        if (refinedStoryParts && refinedStoryParts.length > 0) {
            setStoryParts(refinedStoryParts);
            invalidateSecondaryContent();
        } else {
            throw new Error("L'IA ha restituito una storia vuota. Riprova.");
        }

    } catch (err) {
        setError(err instanceof Error ? err.message : `Impossibile affinare la storia.`);
    } finally {
        setIsRefining(false);
    }
  }, [storyParts, getFullStoryText]);

  const getOrGenerateAudio = useCallback(async (): Promise<string> => {
    if (generatedAudio) {
        return generatedAudio;
    }
    const fullStory = getFullStoryText();
    if (!fullStory) throw new Error("La storia è vuota.");
    
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
        setError(err instanceof Error ? err.message : 'Impossibile riprodurre l\'audio.');
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
        const storyTitle = selectedTitle || (titles ? titles[0] : "Storia Generata dall'IA");

        const storyHtml = storyParts?.map(p => `<p>${p.map(chunk => chunk.replace(/</g, "&lt;").replace(/>/g, "&gt;")).join(' ')}</p>`).join('') || '';
        
        const themeCss = getThemeCss(genre);

        const pageHtml = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${storyTitle}</title>
    <style>
        ${themeCss}
    </style>
</head>
<body>
    <div class="container">
        <img src="${image}" alt="Immagine di Ispirazione">
        <h1>${storyTitle}</h1>
        ${storyHtml}
        <audio controls src="${audioDataUri}">Il tuo browser non supporta l'elemento audio.</audio>
    </div>
</body>
</html>`;

        const htmlBlob = new Blob([pageHtml], { type: 'text/html' });
        const url = URL.createObjectURL(htmlBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'storia-ai.html';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Impossibile esportare la pagina HTML.');
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
      a.download = 'storia-audio.wav';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile scaricare l\'audio.');
    } finally {
      setIsDownloadingAudio(false);
    }
  };

  const isActionInProgress = isLoading || isAudioLoading || isDownloadingAudio || isExportingHtml || isAdvancing || isSuggestingTitles || regeneratingIndex !== null || regeneratingParagraph !== null || isRefining;
  const isConcluded = storyParts && storyParts.length >= 3;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <label htmlFor="image-upload" className="cursor-pointer">
            <div id="story-image-container" className="relative border-2 border-dashed border-gray-500 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors duration-200 h-64 md:h-full flex flex-col justify-center items-center bg-gray-900/50">
              {image ? (
                <img src={image} alt="Anteprima di caricamento" className="max-h-full max-w-full object-contain rounded-md" />
              ) : (
                <>
                  <UploadIcon />
                  <p className="mt-2 text-gray-400">Clicca per caricare un'immagine</p>
                  <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
                </>
              )}
            </div>
          </label>
          <input id="image-upload" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <h2 className="text-2xl font-semibold mb-4 text-indigo-300">La Tela della Tua Storia</h2>
          <p className="text-gray-400 mb-4">Carica un'immagine, scegli un genere e lascia che la nostra IA crei un incipit avvincente per te.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
             <div>
                <label htmlFor="story-genre" className="block text-sm font-medium text-gray-300 mb-2">Genere</label>
                <select id="story-genre" value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow">
                    <option value="Fantasy">Fantasy</option>
                    <option value="Sci-Fi">Fantascienza</option>
                    <option value="Horror">Horror</option>
                    <option value="Mystery">Mistero</option>
                    <option value="Romance">Romantico</option>
                    <option value="Adventure">Avventura</option>
                    <option value="Thriller">Thriller</option>
                    <option value="Humor">Umorismo</option>
                </select>
            </div>
            <div>
                <label htmlFor="story-theme" className="block text-sm font-medium text-gray-300 mb-2">Tema (opzionale)</label>
                <input id="story-theme" type="text" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="es. un artefatto perduto" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"/>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateStory}
              disabled={!image || isLoading}
              className="flex items-center justify-center gap-2 flex-grow bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-all duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100"
            >
              {isLoading ? <LoadingSpinner /> : <SparklesIcon />}
              {isLoading ? 'Creazione in corso...' : 'Genera Storia'}
            </button>
            {isLoading && (
                <button 
                    onClick={handleCancelGeneration} 
                    className="flex-shrink-0 bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200"
                    title="Annulla Generazione"
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
            {selectedTitle || 'L\'Inizio...'}
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
                            title="Rigenera Paragrafo"
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
                            title="Rigenera paragrafo con suggerimento"
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
                                                title="Rigenera"
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
                                                title="Rigenera con suggerimento"
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
                <h4 className="text-lg font-semibold mb-3 text-indigo-400">Clicca un titolo per applicarlo:</h4>
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
              {isSuggestingTitles ? 'Suggerisco...' : 'Suggerisci Titoli'}
            </button>
            {!isConcluded && (
                 <button onClick={handleAdvanceStory} disabled={isActionInProgress || playbackState !== 'stopped'} className="inline-flex items-center gap-2 bg-teal-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-teal-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
                    {isAdvancing ? <LoadingSpinner /> : (storyParts.length < 2 ? <ContinueIcon /> : <ConcludeIcon />)}
                    {isAdvancing ? (storyParts.length < 2 ? 'Continuo...' : 'Concludo...') : (storyParts.length < 2 ? 'Continua Storia' : 'Concludi Storia')}
                </button>
            )}
            {isConcluded && (
                <button onClick={handleRefineStory} disabled={isActionInProgress || playbackState !== 'stopped'} className="inline-flex items-center gap-2 bg-yellow-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-yellow-600 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
                  {isRefining ? <LoadingSpinner /> : <RefineIcon />}
                  {isRefining ? 'Affinando...' : 'Affina Storia'}
                </button>
            )}
            
            <button onClick={handlePlaybackControls} disabled={isActionInProgress || isAudioLoading} className="inline-flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
              {isAudioLoading ? <LoadingSpinner /> : (playbackState === 'playing' ? <PauseIcon /> : (playbackState === 'paused' ? <PlayIcon /> : <SpeakerIcon />) )}
              {isAudioLoading ? 'Caricamento...' : (playbackState === 'playing' ? 'Pausa' : (playbackState === 'paused' ? 'Riprendi' : 'Leggi ad Alta Voce'))}
            </button>
            {playbackState !== 'stopped' && (
                 <button onClick={handleStopPlayback} className="inline-flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-red-700 transition-colors duration-200">
                    <StopIcon />
                    Stop
                </button>
            )}

            <button onClick={handleDownloadAudio} disabled={isActionInProgress || playbackState !== 'stopped'} className="inline-flex items-center gap-2 bg-sky-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-sky-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
              {isDownloadingAudio ? <LoadingSpinner /> : <DownloadIcon />}
              {isDownloadingAudio ? 'Preparo...' : 'Scarica Audio'}
            </button>
            <button onClick={handleExportHtml} disabled={isActionInProgress || playbackState !== 'stopped'} className="inline-flex items-center gap-2 bg-purple-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-purple-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed">
              {isExportingHtml ? <LoadingSpinner /> : <HtmlIcon />}
              {isExportingHtml ? 'Esporto...' : 'Esporta HTML'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryGenerator;