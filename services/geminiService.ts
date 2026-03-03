import { GoogleGenAI, Type } from "@google/genai";
import { SentencePair, TargetLanguage, AviLevel, QuizQuestion, TaalStartLevel, TaalStartLesson } from "../types";

// Initialiseer de AI client
const ai = new GoogleGenAI(process.env.VITE_GEMINI_API_KEY || '');

/**
 * Gebruikt de PHP-brug op Vimexx voor Text-to-Speech
 */
export const synthesizeSpeech = async (text: string, langCode: string = 'nl-NL'): Promise<string> => {
  try {
    const response = await fetch('/tts.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: langCode }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    return data.audioContent || "";
  } catch (error) {
    console.error("TTS Error:", error);
    return "";
  }
};

/**
 * Cruciaal voor Reader.tsx: Zet PCM data om naar een speelbare URL
 */
export const createWavUrl = (base64PCM: string): string => {
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

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

/**
 * Verwerkt tekst en afbeeldingen voor vertaling (NT2)
 */
export const processContent = async (
  textInput: string,
  file: File | null,
  targetLanguage: TargetLanguage
): Promise<SentencePair[]> => {
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  let parts: any[] = [];

  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
  }

  const prompt = `Vertaal naar ${targetLanguage}. Return ONLY JSON array: [{ "nl": "...", "tr": "..." }]`;
  parts.push({ text: prompt + (textInput ? ` Context: ${textInput}` : '') });

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json" }
  });

  return JSON.parse(result.response.text());
};

/**
 * Haalt de betekenis van een woord op (nodig voor Reader.tsx)
 */
export const getWordDefinition = async (word: string): Promise<string> => {
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`Leg het woord "${word}" simpel uit in het Nederlands.`);
    return result.response.text().trim();
  } catch {
    return "Geen betekenis gevonden.";
  }
};

/**
 * Genereert een afbeelding suggestie (nodig voor Reader.tsx)
 */
export const generateIllustration = async (text: string): Promise<string> => {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=400&height=300&nologo=true`;
};

// --- Overige functies om build errors te voorkomen ---
export const simplifyTextToAvi = async (t: string, f: any, l: string) => t;
export const generateQuizQuestions = async () => [];
export const extractWordsForFlash = async () => [];
export const generateTaalStartLesson = async () => ({});
