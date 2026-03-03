import { GoogleGenAI, Type } from "@google/genai";
import { SentencePair, TargetLanguage, AviLevel, QuizQuestion, TaalStartLevel, TaalStartLesson } from "../types";

// Initialiseer de AI client met een fallback voor de key
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
 * Helpt bij het omzetten van bestanden naar base64 voor Gemini
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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
    const base64Data = arrayBufferToBase64(arrayBuffer);
    parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
  }

  const prompt = `Extraheer tekst en vertaal naar ${targetLanguage}. Return ONLY JSON array: [{ "nl": "...", "tr": "..." }]`;
  parts.push({ text: prompt + (textInput ? ` Context: ${textInput}` : '') });

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json" }
  });

  return JSON.parse(result.response.text());
};

/**
 * Vereenvoudigt tekst naar AVI niveau
 */
export const simplifyTextToAvi = async (textInput: string, file: File | null, level: AviLevel): Promise<string> => {
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Herschrijf naar AVI niveau ${level}: ${textInput}`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

/**
 * Genereert quiz vragen
 */
export const generateQuizQuestions = async (text: string): Promise<QuizQuestion[]> => {
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Genereer 5 quizvragen over: ${text} in JSON formaat.`;
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  return JSON.parse(result.response.text());
};

/**
 * Dummy/Fallback data om build errors te voorkomen als andere componenten deze imports nodig hebben
 */
export const extractWordsForFlash = async (): Promise<string[]> => [];
export const getWordDefinition = async (): Promise<string> => "";
export const generateIllustration = async (): Promise<string> => "";
export const generateTaalStartLesson = async (): Promise<any> => ({});
