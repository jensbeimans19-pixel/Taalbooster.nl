import React, { useState, useEffect, useRef } from 'react';
import { Volume2, ArrowRight, Check, Star, Brain, RefreshCw, Home, Mic, MicOff, Play, Pause, Loader2, Image as ImageIcon, Type, Turtle, Rabbit, X, ChevronLeft } from 'lucide-react';
import { TaalStartLevel, TaalStartLesson, TaalStartProgress } from '../types';
import { generateTaalStartLesson, synthesizeSpeech, generateIllustration, createWavUrl } from '../services/geminiService';

interface TaalStartPlayerProps {
  onBack: () => void;
  onEarnStars?: (amount: number) => void;
}

const TaalStartPlayer: React.FC<TaalStartPlayerProps> = ({ onBack, onEarnStars }) => {
  // State
  const [lesson, setLesson] = useState<TaalStartLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);
  const [subStep, setSubStep] = useState(0);
  const [progress, setProgress] = useState<TaalStartProgress>({
    currentLevel: TaalStartLevel.LEVEL_1,
    listeningScore: 0,
    vocabularyScore: 0,
    speakingScore: 0,
    practiceTime: 0,
    errorFrequency: {},
    completedLessons: 0
  });

  // Phase 1 State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);
  const [useBrowserTTS, setUseBrowserTTS] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Phase 2 State
  const [activeWord, setActiveWord] = useState<{ word: string, meaning: string } | null>(null);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number>(-1);
  const [hasReadSentence, setHasReadSentence] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [fontScale, setFontScale] = useState(1.0);
  const [wordImages, setWordImages] = useState<Record<string, string>>({});
  const wordTimingsRef = useRef<{ startPct: number, endPct: number }[]>([]);
  const animationFrameRef = useRef<number>(0);

  // Phase 3 State
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Phase 4 State
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // Load Lesson
  useEffect(() => {
    loadNewLesson();
  }, []);

  // Countdown Timer for Phase 1
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 1 && hasPlayedAudio && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase, countdown, hasPlayedAudio]);

  // Cleanup animation frame
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      window.speechSynthesis.cancel();
    };
  }, []);

  const loadNewLesson = async () => {
    setLoading(true);
    setPhase(1);
    setSubStep(0);
    setAudioUrl(null);
    setImageUrl(null);
    setCountdown(7); // Reset countdown to 7s
    setHasPlayedAudio(false);
    setHasReadSentence(false);
    setHighlightedWordIndex(-1);
    setUseBrowserTTS(false);
    setShowFeedbackModal(false);
    setFeedback(null);
    
    try {
      // Get previous errors (mock for now, would come from progress)
      const errors = Object.keys(progress.errorFrequency).sort((a, b) => progress.errorFrequency[b] - progress.errorFrequency[a]).slice(0, 3);
      
      const newLesson = await generateTaalStartLesson(progress.currentLevel, errors);
      setLesson(newLesson);
      setWordImages({});

      // Generate images for difficult words in Phase 2
      if (newLesson.phase2.difficultWords) {
        newLesson.phase2.difficultWords.forEach(async (dw) => {
          try {
            // Use word + meaning for better context
            const img = await generateIllustration(`${dw.word} (${dw.meaning})`);
            setWordImages(prev => ({ ...prev, [dw.word]: img }));
          } catch (e) {
            console.error(`Failed to gen image for ${dw.word}`, e);
          }
        });
      }

      // Pre-load audio for Phase 1
      try {
        const audioBase64 = await synthesizeSpeech(newLesson.phase1.audioText);
        if (audioBase64) {
          const wavUrl = createWavUrl(audioBase64);
          setAudioUrl(wavUrl);
        } else {
          setUseBrowserTTS(true);
        }
      } catch (e) {
        console.warn("TTS failed, using browser fallback", e);
        setUseBrowserTTS(true);
      }

      // Generate Image
      if (newLesson.phase1.visualSupport) {
          setImageLoading(true);
          try {
            const img = await generateIllustration(newLesson.phase1.visualSupport);
            setImageUrl(img);
          } catch (e) {
            console.error("Image gen failed", e);
            // Fallback image with better seed (remove stopwords)
            const seed = newLesson.phase1.visualSupport.split(' ')
                .filter(w => w.length >= 3 && !['een', 'het', 'de', 'van', 'met', 'op'].includes(w.toLowerCase()))
                .join(' ');
            setImageUrl(`https://picsum.photos/seed/${encodeURIComponent(seed || 'school')}/800/600`);
          } finally {
            // Wait for image to load via onLoad event, but set a timeout just in case
            setTimeout(() => setImageLoading(false), 5000);
          }
      }

    } catch (error) {
      console.error("Failed to load lesson", error);
      alert("Er ging iets mis bij het laden van de les. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  const playAudio = async (textToSpeak?: string) => {
    if (useBrowserTTS) {
      const text = textToSpeak || lesson?.phase1.audioText || "";
      if (!text) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'nl-NL';
      utterance.rate = playbackRate;
      
      utterance.onstart = () => {
        setIsPlaying(true);
        setHasPlayedAudio(true);
      };
      
      utterance.onend = () => {
        setIsPlaying(false);
        setHasReadSentence(true);
        setHighlightedWordIndex(-1);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };

      // Simple karaoke simulation for browser TTS
      // Browser TTS doesn't give precise word timings, so we estimate
      if (textToSpeak) { // Only for Phase 2/4 where we need highlighting
          const words = text.split(/\s+/);
          // Adjust duration based on playback rate
          const estimatedDuration = (text.length * 60) / playbackRate; // rough ms per char
          const wordDuration = estimatedDuration / words.length;
          
          let startTime = Date.now();
          const updateHighlight = () => {
              if (!window.speechSynthesis.speaking) return;
              const elapsed = Date.now() - startTime;
              const idx = Math.min(Math.floor(elapsed / wordDuration), words.length - 1);
              setHighlightedWordIndex(idx);
              animationFrameRef.current = requestAnimationFrame(updateHighlight);
          };
          animationFrameRef.current = requestAnimationFrame(updateHighlight);
      }

      window.speechSynthesis.speak(utterance);
    } else if (audioRef.current) {
      // If already playing, pause it (toggle behavior)
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
      }

      audioRef.current.playbackRate = playbackRate;
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setHasPlayedAudio(true);
        
        if (textToSpeak) {
          startSyncLoop();
        }
      } catch (err) {
        console.error("Playback failed or interrupted", err);
        setIsPlaying(false);
      }

      audioRef.current.onended = () => {
        setIsPlaying(false);
        setHasReadSentence(true);
        setHighlightedWordIndex(-1);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }
  };

  const handleNextPhase = () => {
    if (phase < 4) {
      setPhase((p) => (p + 1) as any);
      setSubStep(0);
      setSelectedOption(null);
      setIsCorrect(null);
      setFeedback(null);
      setSpokenText("");
    } else {
      // Lesson Complete
      if (onEarnStars) onEarnStars(20);
      setProgress(prev => ({
        ...prev,
        completedLessons: prev.completedLessons + 1
      }));
      alert("Les voltooid! Goed gedaan!");
      loadNewLesson(); // Loop to next lesson
    }
  };

  // Helper to clean text for comparison and display
  const cleanPrompt = (text: string) => {
    // Remove "Zeg na:", "Zeg de zin na:", "Zeg hardop:", "na:", "nu zelf na:" etc.
    return text
      .replace(/^(Zeg( de zin)?( hardop)?( na)?|na|nu zelf( na)?)[:\s]*/i, '')
      .trim();
  };

  const cleanForValidation = (text: string) => {
    return text.toLowerCase().replace(/[.,!?]/g, '').trim();
  };

  // Karaoke Helpers
  const calculateWordTimings = (text: string) => {
      const words = text.split(/\s+/);
      const getWeightedLength = (word: string) => {
          let len = word.length + 5; // Base weight
          if (/[.?!]/.test(word)) len += 3; 
          else if (/[,;:]/.test(word)) len += 2; 
          return len;
      };

      const totalWeightedChars = words.reduce((sum, word) => sum + getWeightedLength(word), 0);
      let cumulativeWeightedChars = 0;
      
      return words.map(word => {
          const wLen = getWeightedLength(word);
          const startPct = cumulativeWeightedChars / totalWeightedChars;
          cumulativeWeightedChars += wLen;
          const endPct = cumulativeWeightedChars / totalWeightedChars;
          return { startPct, endPct };
      });
  };

  const startSyncLoop = (audioElement?: HTMLAudioElement) => {
      const audio = audioElement || audioRef.current;
      const update = () => {
          if (!audio || audio.paused || audio.ended) {
              if (audio?.ended) setHighlightedWordIndex(-1);
              return;
          }
          const progress = audio.currentTime / audio.duration;
          if (isFinite(progress)) {
              const idx = wordTimingsRef.current.findIndex(t => progress >= t.startPct && progress < t.endPct);
              if (idx !== -1) setHighlightedWordIndex(idx);
          }
          animationFrameRef.current = requestAnimationFrame(update);
      };
      animationFrameRef.current = requestAnimationFrame(update);
  };

  // Speech Recognition (Mock/Basic implementation)
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Spraakherkenning wordt niet ondersteund in deze browser.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'nl-NL';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setSpokenText(text);
      setIsListening(false);
      
      if (!lesson) return;

      const target = cleanPrompt(lesson.phase4.speakingPrompt);
      const targetClean = cleanForValidation(target);
      const spokenClean = cleanForValidation(text);

      // Check for exact match or high similarity (simple inclusion for now)
      // We check if the spoken text contains the core of the target sentence
      if (spokenClean.includes(targetClean) || targetClean.includes(spokenClean) || spokenClean === targetClean) {
        setFeedback("Goed zo! Dat klonk prima.");
        if (onEarnStars) onEarnStars(5);
      } else {
        // Fallback: check word overlap
        const targetWords = targetClean.split(' ');
        const spokenWords = spokenClean.split(' ');
        const overlap = targetWords.filter(w => spokenWords.includes(w)).length;
        
        if (overlap / targetWords.length > 0.6) {
             setFeedback("Goed zo! Dat klonk prima.");
             if (onEarnStars) onEarnStars(5);
        } else {
            setFeedback("Bijna! Probeer het nog eens.");
        }
      }
      setShowFeedbackModal(true);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setFeedback("Ik kon je niet goed horen.");
      setShowFeedbackModal(true);
    };
  };

  if (loading || !lesson) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Nieuwe les genereren...</p>
        <p className="text-xs text-gray-400 mt-2">Even geduld, AI is aan het werk</p>
      </div>
    );
  }

  const targetSentence = lesson ? cleanPrompt(lesson.phase4.speakingPrompt) : "";

  const handlePrevious = () => {
    if (phase === 1 && subStep === 0) {
      onBack();
    } else if (subStep > 0) {
      setSubStep(s => s - 1);
    } else {
      setPhase(p => (p - 1) as any);
      setSubStep(0); // Or max substep of previous phase if we tracked that, but 0 is safe for now
    }
  };

  const handleImageError = () => {
    setImageLoading(false);
    // If the current image failed, try a reliable fallback (Picsum)
    // Avoid infinite loops if Picsum also fails (though unlikely)
    if (imageUrl && !imageUrl.includes('picsum.photos')) {
        console.warn("Image failed to load, switching to fallback");
        const seed = lesson?.phase1.visualSupport?.split(' ').slice(0, 2).join('-') || 'school';
        setImageUrl(`https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-50/30 flex flex-col">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm border-b border-indigo-100 flex items-center justify-between sticky top-0 z-10">
        <button onClick={handlePrevious} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" title="Vorige stap">
          <ChevronLeft className="w-8 h-8" />
        </button>
        
        <div className="flex flex-col items-center">
          <h2 className="font-heading text-indigo-900 text-lg">Fase {phase}: {
            phase === 1 ? "Luisteren" : 
            phase === 2 ? "Meedoen" : 
            phase === 3 ? "Begrijpen" : "Zelf doen"
          }</h2>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4].map(p => (
              <div key={p} className={`h-2 w-8 rounded-full transition-colors ${p <= phase ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        <div className="w-10"></div>
      </div>

      {/* Content */}
      <div className="flex-grow p-4 md:p-8 max-w-4xl mx-auto w-full relative">
        
        {/* Persistent Audio Element for all phases */}
        <audio ref={audioRef} src={audioUrl || undefined} className="hidden" />

        {/* Feedback Modal - Moved to root level to avoid z-index issues */}
        {showFeedbackModal && feedback && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowFeedbackModal(false)} />
                <div className={`relative bg-white p-8 rounded-[2rem] shadow-2xl border-4 transform animate-bounce-in flex flex-col items-center gap-6 text-center w-full max-w-lg ${feedback.includes("Goed") ? 'border-green-400' : 'border-orange-400'}`}>
                    
                    <button 
                        onClick={() => setShowFeedbackModal(false)}
                        className="absolute top-4 right-4 bg-gray-100 text-gray-500 p-2 rounded-full hover:bg-gray-200 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="flex gap-4 mt-2">
                        {feedback.includes("Goed") ? (
                            <Star className="w-16 h-16 text-yellow-400 animate-bounce" />
                        ) : (
                            <RefreshCw className="w-16 h-16 text-orange-400 animate-spin-slow" />
                        )}
                    </div>
                    
                    <div>
                        <h2 className={`text-3xl font-heading drop-shadow-sm mb-2 ${feedback.includes("Goed") ? 'text-green-600' : 'text-orange-600'}`}>
                            {feedback}
                        </h2>
                        {spokenText && (
                            <div className="bg-gray-50 p-4 rounded-xl mt-4 border border-gray-100">
                                <p className="text-gray-400 text-xs uppercase font-bold mb-1">Jij zei:</p>
                                <p className="text-xl text-gray-700 font-medium italic">"{spokenText}"</p>
                            </div>
                        )}
                    </div>

                    {feedback.includes("Goed") ? (
                        <button 
                            onClick={handleNextPhase}
                            className="w-full bg-[#8DBF45] text-white font-heading font-bold text-xl py-4 rounded-2xl shadow-lg hover:bg-[#7ca83d] transition-all transform hover:scale-105 flex items-center justify-center gap-2 mt-2"
                        >
                            Volgende Les <ArrowRight className="w-6 h-6" />
                        </button>
                    ) : (
                        <button 
                            onClick={() => setShowFeedbackModal(false)}
                            className="w-full bg-orange-100 text-orange-700 font-heading font-bold text-xl py-4 rounded-2xl shadow-sm hover:bg-orange-200 transition-all flex items-center justify-center gap-2 mt-2"
                        >
                            Probeer Opnieuw <RefreshCw className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* PHASE 1: LISTENING */}
        {phase === 1 && (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center">
            <div className="mb-8 relative">
                {imageLoading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 rounded-3xl backdrop-blur-sm">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    </div>
                )}
                {imageUrl ? (
                    <img 
                        src={imageUrl} 
                        alt="Visual support" 
                        className="w-64 h-64 object-cover rounded-3xl shadow-lg border-4 border-white" 
                        onLoad={() => setImageLoading(false)}
                        onError={handleImageError}
                    />
                ) : (
                    <div className="w-64 h-64 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-300 border-4 border-white shadow-lg">
                        <ImageIcon className="w-24 h-24" />
                    </div>
                )}
                <button 
                    onClick={() => playAudio()}
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition-transform hover:scale-110 z-30"
                >
                    {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                </button>
            </div>
            
            <h3 className="text-xl text-gray-500 font-medium mb-12">Luister goed...</h3>

            <button 
                onClick={handleNextPhase}
                disabled={countdown > 0}
                className={`px-12 py-6 rounded-2xl text-2xl font-bold shadow-xl flex items-center gap-4 transition-all w-full max-w-md justify-center ${
                  countdown > 0 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-2 border-gray-300' 
                  : 'bg-[#8DBF45] text-white hover:bg-[#7ca83d] hover:scale-105 border-b-8 border-[#6da32b] active:border-b-0 active:translate-y-2'
                }`}
            >
                {countdown > 0 ? (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span>Nog {countdown}s...</span>
                  </>
                ) : (
                  <>
                    Verder <ArrowRight className="w-8 h-8" />
                  </>
                )}
            </button>
          </div>
        )}

        {/* PHASE 2: GUIDED READING */}
        {phase === 2 && (
          <div className="flex flex-col items-center h-full animate-fade-in">
            {/* Sticky Control Bar */}
            <div className="sticky top-0 z-40 mb-8 transition-all w-full max-w-2xl">
                <div className="bg-white/95 backdrop-blur-md p-2 pl-3 pr-3 rounded-[3rem] shadow-xl border border-gray-100 flex items-center justify-center gap-3 overflow-x-auto min-h-[4rem]">
                    {/* Font Size Slider */}
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                        <Type className="w-4 h-4 text-gray-500" />
                        <input 
                            type="range" 
                            min="0.8" 
                            max="1.5" 
                            step="0.1" 
                            value={fontScale}
                            onChange={(e) => setFontScale(parseFloat(e.target.value))}
                            className="w-16 accent-[#005B8C] h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            title="Tekstgrootte aanpassen"
                        />
                    </div>

                    {/* Speed Slider */}
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                        <Turtle className="w-4 h-4 text-[#8DBF45]" />
                        <input 
                            type="range" 
                            min="0.5" 
                            max="1.5" 
                            step="0.1" 
                            value={playbackRate}
                            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                            className="w-16 accent-[#005B8C] h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            title="Snelheid aanpassen"
                        />
                        <Rabbit className="w-4 h-4 text-orange-500" />
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-lg border-2 border-indigo-50 mb-8 w-full text-center relative">
                <p 
                    className="font-heading leading-relaxed text-gray-800 transition-all duration-300"
                    style={{ fontSize: `${2.25 * fontScale}rem` }}
                >
                    {lesson.phase2.text.split(" ").map((word, idx) => {
                        const difficultWord = lesson.phase2.difficultWords.find(dw => dw.word.toLowerCase().includes(word.toLowerCase().replace(/[.,!?]/g, "")));
                        const isHighlighted = highlightedWordIndex === idx;
                        
                        return (
                            <span 
                                key={idx}
                                onMouseEnter={() => difficultWord && setActiveWord(difficultWord)}
                                onMouseLeave={() => setActiveWord(null)}
                                onClick={() => difficultWord && setActiveWord(difficultWord)}
                                className={`inline-block mx-1 px-2 rounded-lg transition-all cursor-pointer ${
                                    isHighlighted
                                    ? 'bg-indigo-100 text-indigo-700 scale-110 font-bold shadow-sm'
                                    : difficultWord 
                                        ? 'text-indigo-600 font-bold border-b-2 border-indigo-200 hover:bg-indigo-50' 
                                        : 'text-gray-800'
                                }`}
                            >
                                {word}
                            </span>
                        );
                    })}
                </p>
            </div>

            {activeWord && (
                <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg mb-8 animate-bounce-in max-w-lg w-full">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <img 
                                src={wordImages[activeWord.word] || `https://picsum.photos/seed/${encodeURIComponent(activeWord.word)}/150/150`} 
                                alt="Uitleg" 
                                className="w-24 h-24 rounded-xl object-cover border-2 border-white/20 bg-indigo-500"
                            />
                        </div>
                        <div className="text-left">
                            <p className="text-lg font-bold mb-1">Uitleg:</p>
                            <p className="text-xl">{activeWord.meaning}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-4 mt-auto">
                <button 
                    onClick={() => {
                        // Calculate timings first
                        const timings = calculateWordTimings(lesson.phase2.text);
                        wordTimingsRef.current = timings;
                        playAudio(lesson.phase2.text);
                    }}
                    className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl px-6 py-3 font-bold flex items-center gap-2 transition-colors"
                >
                    <Volume2 className="w-5 h-5" /> Lees voor
                </button>
                <button 
                    onClick={handleNextPhase}
                    disabled={!hasReadSentence}
                    className={`rounded-xl px-6 py-3 font-bold flex items-center gap-2 transition-all ${
                        hasReadSentence 
                        ? 'bg-[#8DBF45] text-white hover:bg-[#7ca83d] shadow-lg hover:scale-105' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    Verder <ArrowRight className="w-5 h-5" />
                </button>
            </div>
          </div>
        )}

        {/* PHASE 3: COMPREHENSION */}
        {phase === 3 && (
          <div className="flex flex-col items-center h-full animate-fade-in pt-4">
             {lesson.phase3.questions.map((q, qIdx) => (
                 <div key={qIdx} className={`w-full max-w-xl mb-8 ${subStep === qIdx ? 'block' : 'hidden'}`}>
                    <h3 className="text-2xl font-bold text-indigo-900 mb-6 text-center">{q.question}</h3>
                    <div className="space-y-3">
                        {q.options.map((option, oIdx) => (
                            <button
                                key={oIdx}
                                onClick={() => {
                                    if (isCorrect === true) return;
                                    setSelectedOption(oIdx);
                                    if (oIdx === q.correctAnswer) {
                                        setIsCorrect(true);
                                        if (onEarnStars) onEarnStars(5);
                                        setTimeout(() => {
                                            if (subStep < lesson.phase3.questions.length - 1) {
                                                setSubStep(subStep + 1);
                                                setSelectedOption(null);
                                                setIsCorrect(null);
                                            } else {
                                                handleNextPhase();
                                            }
                                        }, 1500);
                                    } else {
                                        setIsCorrect(false);
                                    }
                                }}
                                className={`w-full p-4 rounded-xl text-left text-lg font-medium border-2 transition-all transform ${
                                    selectedOption === oIdx 
                                        ? isCorrect 
                                            ? 'bg-green-100 border-green-500 text-green-800 scale-105'
                                            : 'bg-red-50 border-red-300 text-red-800'
                                        : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    {option}
                                    {selectedOption === oIdx && isCorrect && <Check className="w-6 h-6 text-green-600" />}
                                </div>
                            </button>
                        ))}
                    </div>
                 </div>
             ))}
          </div>
        )}

        {/* PHASE 4: PRODUCTION */}
        {phase === 4 && (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in pt-4 text-center max-w-3xl mx-auto">
            <h3 className="text-2xl font-heading text-indigo-900 mb-6">Zeg na:</h3>
            
            <div className="bg-white p-8 rounded-[2rem] shadow-lg border-2 border-indigo-100 mb-8 w-full flex flex-row items-center justify-between gap-6">
                <p className="text-3xl md:text-4xl font-heading text-indigo-900 leading-tight text-left flex-grow">
                    {targetSentence.split(" ").map((word, idx) => (
                        <span 
                            key={idx} 
                            className={`inline-block mx-1 transition-all duration-200 ${
                                highlightedWordIndex === idx 
                                ? 'text-indigo-600 font-bold scale-110 bg-indigo-50 rounded px-1' 
                                : 'text-indigo-900'
                            }`}
                        >
                            {word}
                        </span>
                    ))}
                </p>
                
                <div className="flex items-center gap-4 flex-shrink-0">
                    <button 
                        onClick={async () => {
                            if (isGeneratingAudio) return;
                            setIsGeneratingAudio(true);
                            try {
                                const audioBase64 = await synthesizeSpeech(targetSentence);
                                if (!audioBase64) throw new Error("No audio generated");
                                const wavUrl = createWavUrl(audioBase64);
                                const audio = new Audio(wavUrl);
                                
                                // Calculate timings
                                const timings = calculateWordTimings(targetSentence);
                                wordTimingsRef.current = timings;
                                
                                audio.play();
                                startSyncLoop(audio);
                                
                                audio.onended = () => {
                                    setHighlightedWordIndex(-1);
                                    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                                };
                            } catch (e) {
                                console.error("Failed to play target sentence", e);
                                // Fallback to browser TTS if Gemini fails
                                const utterance = new SpeechSynthesisUtterance(targetSentence);
                                utterance.lang = 'nl-NL';
                                window.speechSynthesis.speak(utterance);
                            } finally {
                                setIsGeneratingAudio(false);
                            }
                        }}
                        disabled={isGeneratingAudio}
                        className={`bg-indigo-100 hover:bg-indigo-200 text-indigo-600 p-4 rounded-full transition-colors ${isGeneratingAudio ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        {isGeneratingAudio ? <Loader2 className="w-8 h-8 animate-spin" /> : <Volume2 className="w-8 h-8" />}
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-2xl animate-bounce-x">🗣️</span>
                        <ArrowRight className="w-6 h-6 text-gray-400" />
                        <button
                            onClick={isListening ? () => {} : startListening}
                            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                                isListening 
                                ? 'bg-red-100 text-red-600 animate-pulse border-4 border-red-200' 
                                : 'bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 hover:scale-110 border-4 border-indigo-100'
                            }`}
                        >
                            {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                        </button>
                    </div>
                </div>
            </div>

            <p className="mt-2 text-lg text-gray-500 font-medium mb-8">
                {isListening ? "Ik luister..." : "Klik op de microfoon en spreek"}
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default TaalStartPlayer;
