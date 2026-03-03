import { GoogleGenAI } from "@google/genai";
import { SentencePair, TargetLanguage, AviLevel, QuizQuestion, TaalStartLesson } from "../types";

// Setup Gemini
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenAI(apiKey);

/**
 * TTS via Vimexx PHP Bridge
 */
export const synthesizeSpeech = async (text: string, langCode: string = 'nl-NL'): Promise<string> => {
  try {
    const response = await fetch('/tts.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: langCode }),
    });
    const data = await response.json();
    return data.audioContent || "";
  } catch (error) {
    console.error("TTS Error:", error);
    return "";
  }
};

/**
 * PCM to WAV (Nodig voor Reader.tsx)
 */
export const createWavUrl = (base64PCM: string): string => {
  try {
    const binaryString = atob(base64PCM);
    const len = binaryString.length;
    const buffer = new ArrayBuffer(44 + len);
    const view = new DataView(buffer);
    const writeString = (v: DataView, o: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + len, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 24000, true);
    view.setUint32(28, 24000 * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, len, true);
    const bytes = new Uint8Array(buffer, 44);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  } catch { return ""; }
};

/**
 * NT2 Processing
 */
export const processContent = async (textInput: string, file: File | null, targetLanguage: TargetLanguage): Promise<SentencePair[]> => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Vertaal naar ${targetLanguage}. JSON: [{ "nl": "...", "tr": "..." }]`;
  const result = await model.generateContent(prompt + textInput);
  return JSON.parse(result.response.text());
};

/**
 * AVI Simplification
 */
export const simplifyTextToAvi = async (textInput: string, file: File | null, level: AviLevel): Promise<string> => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(`Herschrijf naar AVI ${level}: ${textInput}`);
  return result.response.text().trim();
};

/**
 * Woord uitleg
 */
export const getWordDefinition = async (word: string): Promise<string> => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(`Leg uit: ${word}`);
  return result.response.text().trim();
};

/**
 * Image Gen
 */
export const generateIllustration = async (text: string): Promise<string> => {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=400&height=300&nologo=true`;
};

/**
 * Demo Data (Gevraagd door SchoolWorkspace.tsx)
 */
export const getDemoData = (): SentencePair[] => [
  { nl: "Hallo, hoe gaat het?", tr: "Hello, how are you?" },
  { nl: "De zon schijnt.", tr: "The sun is shining." }
];

/**
 * Overige Exports om build errors te voorkomen
 */
export const generateQuizQuestions = async (): Promise<QuizQuestion[]> => [];
export const extractWordsForFlash = async (): Promise<string[]> => [];
export const generateTaalStartLesson = async (): Promise<TaalStartLesson> => ({} as any);
