/**
 * Synthesizes speech using the PHP bridge on your own server (Vimexx).
 * This replaces the direct Gemini SDK call to ensure security and stability on shared hosting.
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

    if (!response.ok) {
      throw new Error(`Server fout: ${response.status}`);
    }

    const data = await response.json();

    // De Google API stuurt via de PHP-brug de audio terug als base64 in 'audioContent'
    if (data.audioContent) {
      return data.audioContent;
    }
    
    throw new Error("Geen audioContent ontvangen van de server.");
  } catch (error: any) {
    console.warn("TTS via PHP-brug mislukt, we gebruiken browser fallback:", error.message);
    return ""; // Geeft lege string terug zodat de app weet dat het niet is gelukt
  }
};
