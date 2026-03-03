import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SentencePair, TargetLanguage, AviLevel, QuizQuestion } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * helper to encode string to base64
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

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

/**
 * Wraps raw PCM data in a WAV container to allow pitch-preserving playback in browsers.
 */
export const createWavUrl = (base64PCM: string): string => {
  const binaryString = atob(base64PCM);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + len, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, 24000, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, 24000 * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, len, true);

  // write the PCM samples
  const bytes = new Uint8Array(buffer, 44);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

async function prepareContent(textInput: string, file: File | null) {
  let parts: any[] = [];
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = arrayBufferToBase64(arrayBuffer);
    parts.push({
      inlineData: { mimeType: file.type, data: base64Data }
    });
  }
  return { parts, textContext: textInput };
}

/**
 * Processes text/image for NT2 Mode (Translation + Segmentation)
 */
export const processContent = async (
  textInput: string,
  file: File | null,
  targetLanguage: TargetLanguage
): Promise<SentencePair[]> => {
  
  const { parts, textContext } = await prepareContent(textInput, file);

  const prompt = `
    You are an expert NT2 (Dutch as Second Language) tutor.
    Task: Extract Dutch text from input, correct OCR errors, segment into logical sentences.
    Translate each sentence into language code: '${targetLanguage}'.
    ${textContext ? `Additional context: "${textContext}"` : ''}
    Return ONLY a JSON array of objects: [{ "nl": "...", "tr": "..." }].
  `;

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            nl: { type: Type.STRING },
            tr: { type: Type.STRING }
          },
          required: ["nl", "tr"]
        }
      }
    }
  });

  const jsonText = response.text || "[]";
  try {
    return JSON.parse(jsonText) as SentencePair[];
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to process content.");
  }
};

/**
 * Simplifies text to a specific AVI level for Dyslexia Mode.
 */
export const simplifyTextToAvi = async (
  textInput: string,
  file: File | null,
  level: AviLevel
): Promise<string> => {
  const { parts, textContext } = await prepareContent(textInput, file);

  const prompt = `
    Je bent een expert in leesonderwijs.
    Opdracht:
    1. Haal de Nederlandse tekst uit de input (indien afbeelding/bestand).
    2. Herschrijf de tekst zodat deze PRECIES past bij **AVI niveau ${level}**.
    
    Richtlijnen voor AVI ${level}:
    - Start/M3/E3: Korte zinnen, eenlettergrepige woorden, geen moeilijke clusters.
    - M4-E5: Iets langere zinnen, samengestelde woorden mag, maar blijf concreet.
    - M6+: Complexere structuren mag, maar houd het leesbaar voor iemand met dyslexie.
    
    Belangrijk:
    - Behoud de inhoud en het verhaal.
    - Maak de tekst NIET kinderachtig als het onderwerp serieus is, maar wel makkelijker leesbaar.
    - Geef ALLEEN de herschreven tekst terug als platte tekst. Geen JSON.
    ${textContext ? `Context: "${textContext}"` : ''}
  `;

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts }
  });

  return response.text?.trim() || "";
};

/**
 * Generates quiz questions based on the text.
 */
export const generateQuizQuestions = async (text: string): Promise<QuizQuestion[]> => {
  const prompt = `
    Genereer 5 begripsvragen in het Nederlands over de volgende tekst.
    Doelgroep: Leerlingen die oefenen met lezen (dyslexie/NT2).
    Maak de vragen duidelijk en niet te moeilijk.
    Geef voor elke vraag 3 antwoordopties, waarvan er één correct is.
    
    Tekst: "${text.substring(0, 3000)}"

    Return ONLY a JSON array with this structure:
    [
      {
        "question": "Vraag hier...",
        "options": ["Optie A", "Optie B", "Optie C"],
        "correctIndex": 0 (index of the correct option 0-2)
      }
    ]
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            correctIndex: { type: Type.INTEGER }
          },
          required: ["question", "options", "correctIndex"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]") as QuizQuestion[];
  } catch (e) {
    console.error("Quiz generation failed", e);
    return [];
  }
};

/**
 * Extracts words for Flash Card Mode.
 */
export const extractWordsForFlash = async (
  textInput: string,
  file: File | null,
  level: AviLevel | null
): Promise<string[]> => {
  const { parts, textContext } = await prepareContent(textInput, file);

  // If no input is provided, generate words based on AVI level
  if (!textInput && !file && level) {
      const genPrompt = `Genereer een lijst van 30 willekeurige Nederlandse oefenwoorden die perfect passen bij **AVI niveau ${level}**. Return JSON string array.`;
      const res = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: genPrompt }] }],
          config: { responseMimeType: "application/json" }
      });
      return JSON.parse(res.text || "[]");
  }

  const prompt = `
    Haal de belangrijkste oefenwoorden uit deze tekst.
    Filter stopwoorden of te simpele woorden (zoals 'de', 'het', 'een') tenzij ze relevant zijn voor beginners.
    Zorg voor een lijst van 20-50 woorden.
    ${textContext ? `Context: "${textContext}"` : ''}
    Return ONLY a JSON array of strings.
  `;

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: { responseMimeType: "application/json" }
  });

  try {
    return JSON.parse(response.text || "[]") as string[];
  } catch (e) {
    return [];
  }
};

/**
 * Synthesizes speech using Gemini 2.5 Flash TTS
 * This uses the Gemini model to generate high-quality, multilingual speech.
 */
export const synthesizeSpeech = async (text: string, langCode: string = 'nl-NL', retries = 3): Promise<string> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text: text }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const audioContent = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!audioContent) {
          throw new Error("No audio content generated by Gemini.");
      }
      
      return audioContent;
    } catch (error: any) {
      // Check for quota exceeded
      if (error?.status === 'RESOURCE_EXHAUSTED' || error?.code === 429 || error?.message?.includes('429')) {
         console.warn(`Gemini TTS quota exceeded (Attempt ${attempt + 1}/${retries}), retrying...`);
         // Do NOT return immediately, let it retry with backoff
      } else {
         console.warn(`Gemini TTS Generation Error (Attempt ${attempt + 1}/${retries}):`, error.message);
      }
      
      // If it's the last attempt, return null to signal fallback
      if (attempt === retries - 1) {
          console.warn("Gemini TTS failed after retries, falling back to browser TTS.");
          return ""; // Return empty string to signal failure
      }
      
      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  return "";
};

// Caches
const definitionCache = new Map<string, string>();
const illustrationCache = new Map<string, string>();

export const getWordDefinition = async (word: string, contextSentence: string, targetLanguage?: string): Promise<string> => {
  const cacheKey = `${word.toLowerCase()}-${targetLanguage || 'nl'}`;
  
  if (definitionCache.has(cacheKey)) {
    return definitionCache.get(cacheKey)!;
  }

  try {
    let prompt = `
      Je bent een leraar voor kinderen. Leg het woord "${word}" uit in hele simpele taal (Jip en Janneke taal, niveau A1).
      Gebruik GEEN moeilijke woorden zoals 'context' of 'betekenis'.
      De zin waarin het woord staat is: "${contextSentence}".
      Houd het kort: maximaal 2 zinnen.
    `;

    if (targetLanguage && targetLanguage !== 'nl') {
        prompt = `
          You are a tutor for children. Explain the Dutch word "${word}" in the language with code "${targetLanguage}".
          Use very simple language (A1 level). Do NOT use difficult words like 'context'.
          The sentence containing the word is: "${contextSentence}".
          Keep it short: max 2 sentences.
        `;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });
    
    const result = response.text?.trim() || "Geen betekenis gevonden.";
    definitionCache.set(cacheKey, result);
    return result;
  } catch (error) {
    return "Kon betekenis niet ophalen.";
  }
};

export const generateIllustration = async (text: string): Promise<string | null> => {
  const cacheKey = text.toLowerCase();
  
  if (illustrationCache.has(cacheKey)) {
    return illustrationCache.get(cacheKey)!;
  }

  try {
    const prompt = `Create a simple, educational illustration for: "${text}". Style: Colorful flat vector art, for children. No text.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "4:3" } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const result = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        illustrationCache.set(cacheKey, result);
        return result;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.warn("Image generation failed, using fallback:", error);
    // Fallback to Pollinations.ai (AI generation via URL)
    // This ensures the image is still relevant to the text, unlike random seeds
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text + " children's book illustration flat vector style")}?width=800&height=600&nologo=true`;
    illustrationCache.set(cacheKey, fallbackUrl);
    return fallbackUrl;
  }
};

/**
 * Returns static demo data for testing when API quota is exceeded
 */
import { TaalStartLevel, TaalStartLesson } from "../types";

/**
 * Generates a complete TaalStart lesson based on level and previous errors.
 */
export const generateTaalStartLesson = async (
  level: TaalStartLevel,
  previousErrors: string[] = []
): Promise<TaalStartLesson> => {
  const prompt = `
    Genereer een complete TaalStart les voor niveau: ${level}.
    Doelgroep: Beginnnende lezers (NT2/Dyslexie).
    
    Fouten uit vorige lessen (herhaal deze woorden/klanken indien mogelijk): ${previousErrors.join(", ")}

    De les moet 4 fasen hebben:
    1. Luisteren: Een woord, zin of kort verhaal (afhankelijk van niveau) met visuele suggestie.
    2. Meedoen: Dezelfde tekst, maar nu om mee te lezen. Markeer moeilijke woorden.
    3. Begrijpen: 2-3 begripsvragen en een woordoefening.
    4. Zelf doen: Een zin om af te maken of na te zeggen.

    Return ONLY a JSON object with this structure:
    {
      "id": "unique-id",
      "level": "${level}",
      "phase1": {
        "audioText": "Tekst om te luisteren",
        "visualSupport": "Zeer gedetailleerde visuele beschrijving van het plaatje dat EXACT past bij de audioText (voor image generation)",
        "imageUrl": "Emoji"
      },
      "phase2": {
        "text": "Tekst om te lezen (moet identiek zijn aan audioText)",
        "difficultWords": [{"word": "moeilijk", "meaning": "uitleg"}]
      },
      "phase3": {
        "questions": [
          {"question": "Vraag?", "options": ["A", "B", "C"], "correctAnswer": 0}
        ],
        "wordMatching": [{"word": "woord", "meaning": "betekenis"}]
      },
      "phase4": {
        "sentenceCompletion": [
          {"sentence": "Ik loop naar ___.", "missingWord": "huis", "options": ["huis", "vis", "maan"]}
        ],
        "speakingPrompt": "Zeg na: Ik loop naar huis."
      }
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            level: { type: Type.STRING },
            phase1: {
              type: Type.OBJECT,
              properties: {
                audioText: { type: Type.STRING },
                visualSupport: { type: Type.STRING },
                imageUrl: { type: Type.STRING }
              },
              required: ["audioText", "visualSupport"]
            },
            phase2: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                difficultWords: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      meaning: { type: Type.STRING }
                    },
                    required: ["word", "meaning"]
                  }
                }
              },
              required: ["text", "difficultWords"]
            },
            phase3: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctAnswer: { type: Type.INTEGER }
                    },
                    required: ["question", "options", "correctAnswer"]
                  }
                },
                wordMatching: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      meaning: { type: Type.STRING }
                    },
                    required: ["word", "meaning"]
                  }
                }
              },
              required: ["questions", "wordMatching"]
            },
            phase4: {
              type: Type.OBJECT,
              properties: {
                sentenceCompletion: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      sentence: { type: Type.STRING },
                      missingWord: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["sentence", "missingWord", "options"]
                  }
                },
                speakingPrompt: { type: Type.STRING }
              },
              required: ["sentenceCompletion", "speakingPrompt"]
            }
          },
          required: ["id", "level", "phase1", "phase2", "phase3", "phase4"]
        }
      }
    });

    const lesson = JSON.parse(response.text || "{}") as TaalStartLesson;
    
    // Ensure consistency: Phase 2 text MUST match Phase 1 audioText
    if (lesson.phase1 && lesson.phase2) {
        lesson.phase2.text = lesson.phase1.audioText;
    }
    
    return lesson;
  } catch (e: any) {
    if (e?.status === 'RESOURCE_EXHAUSTED' || e?.code === 429 || e?.message?.includes('429')) {
      console.warn("Gemini Quota Exceeded for Lesson Generation. Using fallback lesson.");
    } else {
      console.error("Failed to generate TaalStart lesson, using fallback", e);
    }
    return FALLBACK_LESSON;
  }
};

const FALLBACK_LESSON: TaalStartLesson = {
  id: "fallback-1",
  level: TaalStartLevel.LEVEL_1,
  phase1: {
    audioText: "De kat zit op de mat.",
    visualSupport: "Een kat op een mat",
    imageUrl: "https://picsum.photos/seed/kat/800/600"
  },
  phase2: {
    text: "De kat zit op de mat.",
    difficultWords: [
      { word: "kat", meaning: "Een huisdier dat miauwt." },
      { word: "mat", meaning: "Een kleedje op de grond." }
    ]
  },
  phase3: {
    questions: [
      { question: "Waar zit de kat?", options: ["Op de stoel", "Op de mat", "Op tafel"], correctAnswer: 1 },
      { question: "Wat is een kat?", options: ["Een huisdier", "Een auto", "Een plant"], correctAnswer: 0 }
    ],
    wordMatching: []
  },
  phase4: {
    sentenceCompletion: [],
    speakingPrompt: "Zeg na: De kat zit op de mat."
  }
};

/**
 * Returns static demo data for testing when API quota is exceeded
 */
export const getDemoData = (): SentencePair[] => {
    return [
        { nl: "Hallo, hoe gaat het met jou vandaag?", tr: "مرحبا، كيف حالك اليوم؟" },
        { nl: "Ik leer Nederlands op school.", tr: "أنا أتعلم اللغة الهولندية في المدرسة." },
        { nl: "De zon schijnt en de lucht is blauw.", tr: "الشمس مشرقة والسماء زرقاء." },
        { nl: "Wij gaan samen naar de bibliotheek.", tr: "نحن ذاهبون إلى المكتبة معًا." },
        { nl: "Lezen is belangrijk voor je toekomst.", tr: "القراءة مهمة لمستقبلك." }
    ];
};