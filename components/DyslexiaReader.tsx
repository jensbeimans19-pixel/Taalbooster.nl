import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, Play, Pause, RotateCw, RotateCcw, Type, Loader2, Turtle, Rabbit, Sparkles, X, CheckCircle, Star, HelpCircle, BrainCircuit, Mic, MicOff, PartyPopper, Trophy, Flame, Image as ImageIcon } from 'lucide-react';
import { synthesizeSpeech, getWordDefinition, createWavUrl, generateQuizQuestions, generateIllustration } from '../services/geminiService';
import { QuizQuestion } from '../types';

interface DyslexiaReaderProps {
  text: string;
  onBack: () => void;
  aviLevel: string;
  onEarnStars: (amount: number) => void;
}

interface DefinitionState {
  word: string;
  text: string;
  wordIndex: number;
  imageUrl?: string;
}

const DyslexiaReader: React.FC<DyslexiaReaderProps> = ({ text, onBack, aviLevel, onEarnStars }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [fontSize, setFontSize] = useState(24);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  // New Features State
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [definitionState, setDefinitionState] = useState<DefinitionState | null>(null);
  const [isLoadingDef, setIsLoadingDef] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false); // New explicit image loading state
  
  // Karaoke / Voice State
  const [isListening, setIsListening] = useState(false);
  const [matchedIndices, setMatchedIndices] = useState<Set<number>>(new Set());
  const [karaokeScore, setKaraokeScore] = useState<{ stars: number, accuracy: number } | null>(null);
  const [waitingForStart, setWaitingForStart] = useState(false);

  // Quiz & Completion State
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizActive, setQuizActive] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Sentence Rewards State
  const awardedSentences = useRef<Set<number>>(new Set());
  const [starToast, setStarToast] = useState<{ x: number, y: number } | null>(null);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Definition Logic Refs
  const definitionCache = useRef<Map<string, string>>(new Map());
  const imageCache = useRef<Map<string, string>>(new Map());
  const hoverTimeoutRef = useRef<any>(null);

  // Voice Logic Refs
  const isListeningRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const ignoredResultIndexRef = useRef(0);

  // State Ref for Voice Control to avoid stale closures in event listeners
  const stateRef = useRef({
      waitingForStart,
      matchedIndices,
  });

  const words = useMemo(() => text.trim().split(/\s+/), [text]);

  // Identify sentence endings (words ending with . ! ? or .")
  const sentenceEndIndices = useMemo(() => {
    const set = new Set<number>();
    words.forEach((w, i) => {
        if (/[.?!]['"]?$/.test(w)) set.add(i);
    });
    return set;
  }, [words]);

  useEffect(() => {
      stateRef.current = { waitingForStart, matchedIndices };
  }, [waitingForStart, matchedIndices]);

  // Sync Logic - Weighted for pauses
  const wordTimings = useMemo(() => {
    const getWeightedLength = (word: string) => {
        let len = word.length + 12; // Base weight for every word
        // Add "virtual characters" for punctuation to account for pauses in TTS
        if (/[.?!]/.test(word)) len += 25; // Strong pause (sentence end)
        else if (/[,;:]/.test(word)) len += 10; // Weak pause
        return len;
    };

    const totalWeightedChars = words.reduce((sum, word) => sum + getWeightedLength(word), 0);
    let cumulativeWeightedChars = 0;
    
    return words.map((word) => {
        const wLen = getWeightedLength(word);
        const startPct = cumulativeWeightedChars / totalWeightedChars;
        cumulativeWeightedChars += wLen;
        const endPct = cumulativeWeightedChars / totalWeightedChars;
        return { startPct, endPct };
    });
  }, [words]);

  useEffect(() => {
    return () => {
      stopAudio();
      stopListening();
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
        const wasPlaying = !audioRef.current.paused;
        audioRef.current.pause();
        audioRef.current.playbackRate = playbackRate;
        // Restart to ensure sync as requested
        audioRef.current.currentTime = 0;
        setCurrentWordIndex(-1);
        
        if (wasPlaying) {
            audioRef.current.play().catch(e => console.error(e));
            startSyncLoop(audioRef.current);
        }
    }
  }, [playbackRate]);

  // Force scroll to top of PAGE when text loads
  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = setTimeout(() => {
        window.scrollTo(0, 0);
    }, 100);
    return () => clearTimeout(timer);
  }, [text]);

  // --- AUTO SCROLL LOGIC ---
  useEffect(() => {
      let targetIndex = currentWordIndex;
      
      if (isListening && matchedIndices.size > 0) {
          const indices = Array.from(matchedIndices) as number[];
          const maxMatched = Math.max(...indices);
          targetIndex = maxMatched;
      }

      if (targetIndex !== -1 && wordRefs.current[targetIndex]) {
          const element = wordRefs.current[targetIndex];
          if (element) {
            const rect = element.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            if (rect.top < viewportHeight * 0.3 || rect.bottom > viewportHeight * 0.7) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
      }
  }, [currentWordIndex, matchedIndices, isListening]);

  // --- REWARD LOGIC ---
  const triggerSentenceReward = (index: number) => {
      if (awardedSentences.current.has(index)) return;
      
      awardedSentences.current.add(index);
      onEarnStars(1);
      
      const el = wordRefs.current[index];
      if (el) {
          const rect = el.getBoundingClientRect();
          // Center toast above word
          setStarToast({ x: rect.left + (rect.width / 2), y: rect.top });
          setTimeout(() => setStarToast(null), 1500);
      }
  };

  // Monitor TTS for rewards
  useEffect(() => {
      if (currentWordIndex !== -1 && sentenceEndIndices.has(currentWordIndex)) {
          triggerSentenceReward(currentWordIndex);
      }
  }, [currentWordIndex, sentenceEndIndices]);

  // Monitor Karaoke for rewards
  useEffect(() => {
      if (isListening && matchedIndices.size > 0) {
          sentenceEndIndices.forEach(idx => {
              if (matchedIndices.has(idx)) {
                  triggerSentenceReward(idx);
              }
          });
      }
  }, [matchedIndices, isListening, sentenceEndIndices]);


  const stopAudio = () => {
    if (audioRef.current) {
        audioRef.current.pause();
    }
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
  };

  const startSyncLoop = (audio: HTMLAudioElement) => {
      const update = () => {
          if (audio.paused || audio.ended) return;
          
          const progress = audio.currentTime / audio.duration;
          if (isFinite(progress)) {
              // Find the word interval that contains current progress
              const idx = wordTimings.findIndex(t => progress >= t.startPct && progress < t.endPct);
              
              if (idx !== -1) {
                  setCurrentWordIndex(idx);
              } else if (progress >= 0.99) {
                  // Near end
                  setCurrentWordIndex(words.length - 1);
              }
          }
          animationFrameRef.current = requestAnimationFrame(update);
      };
      animationFrameRef.current = requestAnimationFrame(update);
  };

  const handlePlay = async () => {
    if (isListening) stopListening();

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    // If audio exists but rate changed, we might need to update rate or regenerate if logic requires
    if (audioRef.current) {
        audioRef.current.playbackRate = playbackRate; // Ensure rate is applied
        audioRef.current.play();
        startSyncLoop(audioRef.current);
        setIsPlaying(true);
        return;
    }

    setIsLoadingAudio(true);
    setAudioError(null);
    try {
        const audioBase64 = await synthesizeSpeech(text);
        const wavUrl = createWavUrl(audioBase64);
        
        const audio = new Audio(wavUrl);
        audio.playbackRate = playbackRate;
        
        audio.onended = () => {
            setIsPlaying(false);
            setCurrentWordIndex(-1);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };

        audio.onplay = () => {
            startSyncLoop(audio);
        };

        audioRef.current = audio;
        await audio.play();
        setIsPlaying(true);
    } catch (e) {
        console.error("Audio generation failed", e);
        setAudioError("Kon audio niet laden.");
    } finally {
        setIsLoadingAudio(false);
    }
  };

  const handleReset = () => {
      stopAudio();
      stopListening();
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
      }
      setCurrentWordIndex(-1);
      setMatchedIndices(new Set());
      setKaraokeScore(null);
      awardedSentences.current.clear();
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- KARAOKE / VOICE LOGIC ---
  const toggleListening = () => {
      if (isListening) {
          finishKaraoke();
      } else {
          stopAudio(); // Stop TTS if playing
          startListening();
      }
  };

  const startListening = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
          alert("Spraakherkenning niet ondersteund.");
          return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'nl-NL'; // Assume Dutch for Dyslexia Reader
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
          let transcript = '';
          // Using resultIndex is usually safer for continuous, but we must ensure we don't process old results if ref was not cleared.
          // Since we recreate recognition, this is fine, but let's be safe.
          for (let i = event.resultIndex; i < event.results.length; ++i) {
              transcript += event.results[i][0].transcript;
          }
          if (transcript) processSpeech(transcript);
      };

      recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
              setIsListening(false);
              isListeningRef.current = false;
              setWaitingForStart(false);
              setAudioError("Microfoon toegang geweigerd. Sta microfoon toe om te lezen.");
          }
      };

      recognition.onend = () => {
          // Only restart if we are still logically listening and the error wasn't fatal (like not-allowed)
          if (isListeningRef.current && recognitionRef.current) {
              try { recognition.start(); } catch(e) {}
          }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setIsListening(true);
        setWaitingForStart(true);
        setMatchedIndices(new Set());
        isListeningRef.current = true;
        speechStartTimeRef.current = Date.now();
        ignoredResultIndexRef.current = 0;
        setAudioError(null); // Clear previous errors
      } catch(e) {
        console.error(e);
        setAudioError("Kon spraakherkenning niet starten.");
      }
  };

  const stopListening = () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
      }
      setIsListening(false);
      setWaitingForStart(false);
  };

  const normalizeWord = (w: string) => w.toLowerCase().replace(/[.,?!":;()]/g, '');

  const processSpeech = (transcript: string) => {
      if (!isListeningRef.current) return;

      const { waitingForStart, matchedIndices } = stateRef.current;
      const spoken = transcript.toLowerCase();
      let currentlyWaiting = waitingForStart;
      
      // Handle Start Command
      if (currentlyWaiting) {
          if (spoken.includes('start') || spoken.includes('begin')) {
              setWaitingForStart(false);
              currentlyWaiting = false; 
          } else {
              return; // Keep waiting
          }
      }

      // Matching Logic
      const spokenWords = spoken.split(/\s+/).map(normalizeWord).filter(w => w.length > 0);
      const newMatched = new Set(matchedIndices);
      
      // Strict sequential cursor. Start searching AFTER the last matched word.
      let currentCursor = 0;
      const sortedMatched = (Array.from(matchedIndices) as number[]).sort((a, b) => a - b);
      if (sortedMatched.length > 0) {
          currentCursor = sortedMatched[sortedMatched.length - 1] + 1;
      }

      spokenWords.forEach(spokenWord => {
          if (spokenWord === 'start' || spokenWord === 'begin') return;
          if (currentCursor >= words.length) return;

          // DYNAMIC LOOKAHEAD
          // Short words (<= 3 chars) = NO lookahead (Strictly next word).
          // Long words = 5 word lookahead (Allow skipping if hard/missed).
          const isShort = spokenWord.length <= 3;
          const lookAhead = isShort ? 1 : 5; 
          const searchLimit = Math.min(words.length, currentCursor + lookAhead);

          for (let i = currentCursor; i < searchLimit; i++) {
              if (normalizeWord(words[i]) === spokenWord) {
                  // Found a match
                  newMatched.add(i);
                  currentCursor = i + 1;
                  break; 
              }
          }
      });

      setMatchedIndices(newMatched);

      // Auto finish if 95% matched
      if (newMatched.size >= words.length * 0.95) {
          finishKaraoke(newMatched.size);
      }
  };

  const finishKaraoke = (finalCount?: number) => {
      stopListening();
      const count = finalCount || matchedIndices.size;
      const total = words.length;
      const accuracy = Math.round((count / total) * 100);
      
      let stars = 1;
      if (accuracy > 80) stars = 5;
      else if (accuracy > 60) stars = 4;
      else if (accuracy > 40) stars = 3;
      else if (accuracy > 20) stars = 2;

      onEarnStars(stars);
      setKaraokeScore({ stars, accuracy });
  };


  // --- Start Quiz Logic ---
  const handleStartQuiz = async () => {
      stopAudio();
      stopListening();
      setQuizLoading(true);
      try {
          const generatedQuestions = await generateQuizQuestions(text);
          setQuestions(generatedQuestions);
          setQuizActive(true);
      } catch (e) {
          console.error("Failed to generate quiz", e);
          setQuizScore(1);
          setQuizCompleted(true);
          onEarnStars(1);
      } finally {
          setQuizLoading(false);
      }
  };

  const handleAnswer = (optionIndex: number) => {
      if (showFeedback) return;
      setSelectedOption(optionIndex);
      setShowFeedback(true);
      
      const isCorrect = optionIndex === questions[currentQuestionIndex].correctIndex;
      
      setTimeout(() => {
          if (isCorrect) {
              setQuizScore(prev => prev + 1);
          }
          
          if (currentQuestionIndex < questions.length - 1) {
              setCurrentQuestionIndex(prev => prev + 1);
              setSelectedOption(null);
              setShowFeedback(false);
          } else {
              finishQuiz(isCorrect ? quizScore + 1 : quizScore);
          }
      }, 1500);
  };

  const finishQuiz = (finalScore: number) => {
      const starsToAward = Math.min(finalScore, 5);
      onEarnStars(starsToAward);
      setQuizScore(finalScore);
      setQuizCompleted(true);
      setQuizActive(false);
  };

  // --- Definition Logic ---
  const triggerDefinition = async (word: string, index: number) => {
      if (definitionState?.word === word && definitionState?.wordIndex === index) return;
      
      const cleanWord = word.replace(/[.,?!":;()]/g, '');
      const cacheKey = `${cleanWord.toLowerCase()}`;
      
      const cachedDef = definitionCache.current.get(cacheKey);
      const cachedImg = imageCache.current.get(cacheKey);

      setDefinitionState({
          word: cleanWord,
          text: cachedDef || '',
          wordIndex: index,
          imageUrl: cachedImg
      });

      if (cachedDef && cachedImg) return;

      if (!cachedDef) setIsLoadingDef(true);
      if (!cachedImg) setIsLoadingImage(true);
      
      try {
          // Fetch definition if needed
          if (!cachedDef) {
              const def = await getWordDefinition(cleanWord, text.substring(Math.max(0, text.indexOf(cleanWord) - 50), text.indexOf(cleanWord) + 50));
              definitionCache.current.set(cacheKey, def);
              setDefinitionState(prev => {
                  if (prev && prev.word === cleanWord && prev.wordIndex === index) {
                      return { ...prev, text: def };
                  }
                  return prev;
              });
              setIsLoadingDef(false);
          }

          // Fetch Image if needed (Lazy load)
          if (!cachedImg) {
               try {
                   const img = await generateIllustration(cleanWord);
                   imageCache.current.set(cacheKey, img);
                   setDefinitionState(prev => {
                      if (prev && prev.word === cleanWord && prev.wordIndex === index) {
                          return { ...prev, imageUrl: img };
                      }
                      return prev;
                  });
               } catch (e) {
                   console.error("Image generation failed", e);
               } finally {
                   setIsLoadingImage(false);
               }
          } else {
              setIsLoadingImage(false);
          }

      } catch (err) {
          console.error(err);
          setIsLoadingDef(false);
          setIsLoadingImage(false);
      }
  };

  const handleWordHover = (word: string, index: number) => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
          triggerDefinition(word, index);
      }, 700);
  };

  const handleWordLeave = () => {
      if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
      }
  };

  const handleWordClick = async (word: string, index: number) => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      triggerDefinition(word, index);
      if (audioRef.current && audioRef.current.duration) {
         const timing = wordTimings[index];
         if (timing) {
             audioRef.current.currentTime = timing.startPct * audioRef.current.duration;
             if (!isPlaying && !isListening) handlePlay();
         }
      }
  };

  // --- KARAOKE RESULTS OVERLAY ---
  if (karaokeScore) {
      return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full text-center shadow-2xl border-4 border-[#8DBF45] animate-bounce-in relative">
                   <button 
                        onClick={() => setKaraokeScore(null)}
                        className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500"
                   >
                       <X className="w-6 h-6" />
                   </button>
                   
                   <PartyPopper className="w-20 h-20 text-[#8DBF45] mx-auto mb-4 animate-bounce" />
                   <h2 className="text-3xl font-heading text-[#005B8C] mb-2">Goed Gelezen!</h2>
                   <p className="text-gray-500 mb-6">Je hebt {karaokeScore.accuracy}% van de woorden goed uitgesproken.</p>
                   
                   <div className="flex justify-center gap-2 mb-8">
                       {[...Array(5)].map((_, i) => (
                           <Star 
                                key={i} 
                                className={`w-8 h-8 ${i < karaokeScore.stars ? 'text-yellow-400 fill-current' : 'text-gray-200'}`} 
                           />
                       ))}
                   </div>
                   
                   <div className="flex gap-4">
                       <button onClick={() => setKaraokeScore(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50">
                           Sluiten
                       </button>
                       <button onClick={handleStartQuiz} className="flex-1 py-3 bg-[#005B8C] text-white rounded-xl font-bold hover:bg-[#004a73]">
                           Start Quiz
                       </button>
                   </div>
              </div>
          </div>
      )
  }

  // --- QUIZ COMPLETED SCREEN ---
  if (quizCompleted) {
      const stars = Math.min(quizScore, 5);
      return (
          <div className="w-full max-w-lg mx-auto bg-white rounded-[2.5rem] p-10 text-center shadow-2xl border-4 border-[#8DBF45] animate-bounce-in mt-20 mb-20">
              <CheckCircle className="w-20 h-20 text-[#8DBF45] mx-auto mb-4" />
              <h2 className="text-3xl font-heading text-[#005B8C] mb-2">Quiz Compleet!</h2>
              <p className="text-gray-500 mb-6">Je hebt {quizScore} van de {questions.length} vragen goed.</p>
              
              <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200 mb-8 flex flex-col items-center">
                  <Star className="w-12 h-12 text-yellow-500 fill-current mb-2 animate-spin-slow" />
                  <span className="text-4xl font-heading text-yellow-600">+{stars}</span>
                  <span className="text-sm font-bold text-yellow-500 uppercase">Sterren verdiend</span>
              </div>

              <button 
                onClick={onBack}
                className="w-full bg-[#005B8C] text-white py-4 rounded-xl font-bold hover:bg-[#004a73] transition-colors"
              >
                  Terug naar menu
              </button>
          </div>
      );
  }

  // --- QUIZ ACTIVE SCREEN ---
  if (quizActive) {
      const q = questions[currentQuestionIndex];
      return (
          <div className="w-full max-w-2xl mx-auto bg-white rounded-[2.5rem] p-8 shadow-2xl border-4 border-[#005B8C] animate-fade-in mt-8 mb-20">
               <div className="flex justify-between items-center mb-6">
                   <span className="bg-blue-100 text-[#005B8C] px-4 py-1 rounded-full font-bold">Vraag {currentQuestionIndex + 1}/{questions.length}</span>
                   <div className="flex gap-1">
                       {[...Array(questions.length)].map((_, i) => (
                           <div key={i} className={`w-2 h-2 rounded-full ${i < currentQuestionIndex ? 'bg-[#8DBF45]' : 'bg-gray-200'}`} />
                       ))}
                   </div>
               </div>

               <h3 className="text-2xl font-heading text-gray-800 mb-8 leading-snug">
                   {q.question}
               </h3>

               <div className="space-y-4">
                   {q.options.map((option, idx) => {
                       let stateClass = "bg-gray-50 border-2 border-gray-100 hover:border-blue-300";
                       if (showFeedback) {
                           if (idx === q.correctIndex) stateClass = "bg-green-100 border-2 border-green-500 text-green-700";
                           else if (idx === selectedOption) stateClass = "bg-red-100 border-2 border-red-500 text-red-700 opacity-60";
                           else stateClass = "bg-gray-50 border-2 border-gray-100 opacity-50";
                       } else if (selectedOption === idx) {
                           stateClass = "bg-blue-50 border-2 border-[#005B8C]";
                       }

                       return (
                           <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                disabled={showFeedback}
                                className={`w-full p-5 rounded-2xl text-left text-lg font-medium transition-all duration-300 ${stateClass}`}
                           >
                               {option}
                           </button>
                       )
                   })}
               </div>
          </div>
      );
  }

  // --- MAIN READER UI ---
  return (
    <div className="w-full max-w-4xl mx-auto font-body relative">
        {/* Star Toast Animation */}
        {starToast && (
          <div 
            className="fixed z-[150] pointer-events-none flex flex-col items-center animate-bounce-in"
            style={{ left: starToast.x, top: starToast.y - 40, transform: 'translateX(-50%)' }}
          >
             <Star className="w-8 h-8 text-yellow-400 fill-current drop-shadow-md" />
             <span className="text-yellow-600 font-bold text-lg drop-shadow-sm">+1</span>
          </div>
        )}

        <button 
            onClick={() => { stopAudio(); onBack(); }}
            className="absolute -top-16 left-0 flex items-center gap-2 bg-white/50 hover:bg-white text-gray-600 px-4 py-2 rounded-full font-bold transition-all"
        >
            <ArrowLeft className="w-4 h-4" />
            Terug
        </button>

      {/* NEW TOOLBAR DESIGN */}
      <div className="bg-white p-4 rounded-[2rem] shadow-lg border border-gray-100 mb-8 sticky top-4 z-50">
        
        {/* Top Row: AVI Badge & Main Actions */}
        <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-4">
            
            {/* Empty spacer for balance or small info */}
             <div className="w-20 hidden sm:block"></div>

            {/* Center: AVI Badge */}
            <div className="bg-orange-50 text-orange-600 px-6 py-2 rounded-xl font-heading font-bold text-xl tracking-wide border border-orange-100">
                AVI {aviLevel}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3 w-auto justify-end">
                <button
                    onClick={handleReset}
                    className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    title="Begin opnieuw"
                >
                    <RotateCw className="w-5 h-5" />
                </button>
                
                {/* PLAY BUTTON */}
                <button
                    onClick={handlePlay}
                    disabled={isLoadingAudio}
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${
                        isPlaying 
                        ? 'bg-orange-100 border-orange-500 text-orange-500' 
                        : 'bg-white border-orange-500 text-orange-500 hover:bg-orange-50'
                    } ${isLoadingAudio ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                    {isLoadingAudio ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : isPlaying ? (
                        <Pause className="fill-current w-5 h-5" />
                    ) : (
                        <Play className="fill-current ml-1 w-5 h-5" />
                    )}
                </button>

                {/* MIC BUTTON */}
                <button
                    onClick={toggleListening}
                    className={`h-12 px-4 rounded-full flex items-center gap-2 border-2 transition-all shadow-sm ${
                        isListening 
                        ? 'bg-red-500 border-red-500 text-white animate-pulse'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-[#8DBF45] hover:text-[#8DBF45]'
                    }`}
                >
                    {isListening ? (
                         <>
                            <MicOff className="w-5 h-5" />
                            <span className="hidden sm:inline font-bold">Stop</span>
                         </>
                    ) : (
                         <>
                            <Mic className="w-5 h-5" />
                            <span className="hidden sm:inline font-bold">Lezen</span>
                         </>
                    )}
                </button>
            </div>
        </div>

        {/* Bottom Row: Sliders */}
        <div className="flex flex-wrap items-center justify-between gap-6 px-2">
             {/* Font Size */}
             <div className="flex items-center gap-3 flex-1 min-w-[150px]">
                 <Type className="w-4 h-4 text-gray-400" />
                 <input 
                    type="range" 
                    min="18" 
                    max="40" 
                    value={fontSize} 
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-600"
                 />
                 <Type className="w-7 h-7 text-gray-600" />
             </div>

             {/* Divider */}
             <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

             {/* Speed Control */}
             <div className="flex items-center gap-3 flex-1 min-w-[150px]">
                 <Turtle className="w-5 h-5 text-gray-400" />
                 <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.1"
                    value={playbackRate} 
                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                    className="w-full h-2 bg-orange-100 rounded-lg appearance-none cursor-pointer accent-orange-500"
                 />
                 <Rabbit className="w-5 h-5 text-gray-600" />
             </div>
        </div>
      </div>
        
      {audioError && (
          <div className="text-red-500 text-center mb-4 bg-red-50 p-2 rounded-lg">{audioError}</div>
      )}

      {/* START INSTRUCTION OVERLAY FOR KARAOKE */}
      {isListening && waitingForStart && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer"
            onClick={() => setWaitingForStart(false)}
          >
              <div 
                className="bg-[#005B8C] text-white p-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 animate-bounce-in border-4 border-[#8DBF45] transform hover:scale-105 transition-transform"
                onClick={(e) => { e.stopPropagation(); setWaitingForStart(false); }}
              >
                  <div className="bg-white/10 p-4 rounded-full">
                     <Mic className="w-12 h-12 animate-pulse text-[#8DBF45]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold opacity-90 uppercase tracking-widest mb-1">Zeg hardop</p>
                    <p className="text-5xl font-heading">"START"</p>
                  </div>
                  <p className="text-xs opacity-75 mt-2 bg-black/20 px-3 py-1 rounded-full">(Of klik hier)</p>
              </div>
          </div>
      )}

      {/* Text Display Container */}
      <div 
        ref={containerRef}
        className="bg-[#faf5e6] px-8 sm:px-12 py-12 rounded-[2rem] shadow-xl border-4 border-orange-200 min-h-[50vh] relative mb-12"
      >
         <p 
            className="font-dyslexia text-gray-800 leading-[2.5]"
            style={{ 
                fontSize: `${fontSize}px`, 
                letterSpacing: '0.1em',
                wordSpacing: '0.2em'
            }}
         >
             {words.map((word, index) => {
                 const isHighlighted = definitionState?.wordIndex === index;
                 const isPlayingWord = currentWordIndex === index; // TTS Active
                 const isMatchedKaraoke = matchedIndices.has(index); // Voice Active

                 // Differentiate styling
                 let wordClasses = "hover:bg-orange-100 hover:border-orange-200 border border-transparent";
                 
                 if (isMatchedKaraoke) {
                     wordClasses = "bg-green-200 text-green-900 border-green-300 scale-105 font-bold shadow-sm";
                 } else if (isPlayingWord) {
                     wordClasses = "bg-orange-200 text-orange-900 ring-2 ring-orange-400 scale-105";
                 }
                 
                 if (isHighlighted) {
                     wordClasses += " ring-2 ring-[#005B8C] ring-offset-2";
                 }

                 return (
                 <span 
                    key={index}
                    ref={(el) => { wordRefs.current[index] = el; }}
                    onMouseEnter={() => handleWordHover(word, index)}
                    onMouseLeave={handleWordLeave}
                    onClick={() => handleWordClick(word, index)}
                    className={`inline-block mr-3 px-1.5 rounded-lg transition-all duration-200 cursor-pointer ${wordClasses}`}
                 >
                     {word}
                 </span>
             )})}
         </p>
      </div>

      {/* Finish Button - MOVED TO BOTTOM OF PAGE */}
      <div className="flex justify-center pb-20">
          <button 
            onClick={handleStartQuiz}
            disabled={quizLoading}
            className={`bg-[#8DBF45] hover:bg-[#7ca83d] text-white px-8 py-4 rounded-2xl font-heading font-bold text-2xl shadow-xl transform hover:scale-105 transition-all flex items-center gap-3 border-4 border-white ${quizLoading ? 'opacity-80 cursor-wait' : ''}`}
          >
              {quizLoading ? (
                  <>
                    <BrainCircuit className="w-8 h-8 animate-pulse" />
                    Quiz Maken...
                  </>
              ) : (
                  <>
                    <HelpCircle className="w-8 h-8" />
                    Klaar met lezen? Start de Quiz!
                  </>
              )}
          </button>
      </div>

      {/* Definition Pop-up */}
      {(definitionState) && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-[100] flex justify-center pointer-events-none">
            <div className="bg-white text-gray-800 p-6 sm:p-8 rounded-[2rem] shadow-2xl border-4 border-[#005B8C] w-full max-w-xl pointer-events-auto transform transition-all animate-fade-in-up">
                <div className="flex items-start justify-between">
                    <div className="flex-1 pr-6">
                        <div className="flex items-center gap-3 mb-4">
                             <span className="bg-[#8DBF45] text-white text-xs font-heading font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                Betekenis
                             </span>
                             <h3 className="font-heading text-3xl text-[#005B8C] capitalize">
                                {definitionState.word}
                             </h3>
                        </div>
                        
                        <div className="flex gap-5 items-start">
                             {/* Illustration */}
                            <div className="w-24 h-24 bg-gray-50 rounded-2xl flex-shrink-0 border-2 border-gray-100 overflow-hidden flex items-center justify-center shadow-inner relative">
                                {definitionState.imageUrl ? (
                                    <img src={definitionState.imageUrl} alt={definitionState.word} className="w-full h-full object-cover animate-fade-in" />
                                ) : isLoadingImage ? (
                                    <div className="flex flex-col items-center justify-center w-full h-full bg-gray-50">
                                        <Loader2 className="w-8 h-8 text-[#8DBF45] animate-spin mb-1" />
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide animate-pulse">Laden...</span>
                                    </div>
                                ) : (
                                    <ImageIcon className="w-8 h-8 text-gray-300" />
                                )}
                            </div>

                            <div className="flex-1">
                                {isLoadingDef && !definitionState.text ? (
                                     <div className="space-y-3 py-2">
                                        <div className="h-4 bg-gray-100 rounded-full w-3/4 animate-pulse"></div>
                                        <div className="h-4 bg-gray-100 rounded-full w-1/2 animate-pulse"></div>
                                     </div>
                                ) : (
                                    <div className="flex gap-3">
                                        <Sparkles className="w-5 h-5 text-[#8DBF45] mt-1 flex-shrink-0" />
                                        <p className="text-xl font-body leading-relaxed text-gray-600">
                                            {definitionState.text}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => { setDefinitionState(null); setIsLoadingDef(false); setIsLoadingImage(false); }}
                        className="p-3 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors flex-shrink-0"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
      )}

      {!definitionState && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-30">
            <div 
                className="max-w-max mx-auto bg-[#005B8C] text-white px-8 py-4 rounded-full shadow-xl flex items-center gap-3 pointer-events-auto transform hover:scale-105 transition-transform cursor-pointer border-2 border-[#8DBF45]" 
                onClick={() => window.scrollTo({top:0, behavior:'smooth'})}
            >
            <RotateCcw className="w-5 h-5 text-[#8DBF45]" />
            <span className="font-heading tracking-wide text-base font-bold">Tik op een woord voor uitleg & audio</span>
            </div>
        </div>
      )}
    </div>
  );
};

export default DyslexiaReader;