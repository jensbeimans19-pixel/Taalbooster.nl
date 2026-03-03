import { GoogleGenAI, Type } from "@google/genai";
import { SentencePair, TargetLanguage, AviLevel, QuizQuestion, TaalStartLevel, TaalStartLesson } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Synthesizes speech using the PHP bridge on your own server (Vimexx).
 * This ensures security and stability on shared hosting.
 */
export const synthesizeSpeech = async (text: string, langCode: string = 'nl-NL'): Promise<string> => {
  try {
    const response = await fetch('/tts.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text: text,
        lang: langCode 
      }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const data = await response.json();
    if (data.audioContent) {
      return data.audioContent;
    }
    
    throw new Error("No audioContent received from server.");
  } catch (error: any) {
    console.warn("TTS via PHP bridge failed, fallback to empty:", error.message);
    return ""; 
  }
};

/**
 * Helper to encode string to base64 for image processing
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Processes text/image for NT2 Mode (Translation + Segmentation)
 */
export const processContent = async (
  textInput: string,
  file: File | null,
  targetLanguage: TargetLanguage
): Promise<SentencePair[]> => {
  let parts: any[] = [];
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = arrayBufferToBase64(arrayBuffer);
    parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
  }

  const prompt = `
    You are an expert NT2 tutor. Extract Dutch text, correct OCR errors, segment into sentences.
    Translate each to language code: '${targetLanguage}'.
    ${textInput ? `Context: "${textInput}"` : ''}
    Return ONLY a JSON array: [{ "nl": "...", "tr": "..." }].
  `;

  parts.push({ text: prompt });

  const response = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json" }
  });

  return JSON.parse(response.response.text());
};

/**
 * Simplifies text to a specific AVI level
 */
export const simplifyTextToAvi = async (textInput: string, file: File | null, level: AviLevel): Promise<string> => {
  const prompt = `Herschrijf deze tekst naar AVI niveau ${level}. Houd het leesbaar voor dyslexie. Tekst: ${textInput}`;
  const response = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent(prompt);
  return response.response.text().trim();
};

/**
 * Generates quiz questions
 */
export const generateQuizQuestions = async (text: string): Promise<QuizQuestion[]> => {
  const prompt = `Genereer 5 begripsvragen over deze tekst in JSON formaat: ${text}`;
  const response = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.response.text());
};

// --- Rest van de functies (TaalStart, Flashcards etc.) kunnen hieronder blijven staan ---
