import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SentencePair, TargetLanguage, WEB_SPEECH_LANGS, LANGUAGE_LABELS } from '../types';
import { synthesizeSpeech, getWordDefinition, generateIllustration, createWavUrl } from '../services/geminiService';
import { Play, Pause, Loader2, X, Image as ImageIcon, Mic, MicOff, PartyPopper, Trophy, Star, Flame, ChevronRight, RotateCcw, Sparkles, WifiOff, ArrowUpDown, Lock, Rabbit, Turtle, Target, Type, Volume2 } from 'lucide-react';

interface ReaderProps {
  data: SentencePair[];
  onBack: () => void;
  targetLang?: TargetLanguage;
}

interface DefinitionState {
  word: string;
  text: string;
  sentenceIndex: number;
  wordIndex: number;
  side: 'top' | 'bottom';
  imageUrl?: string;
}

interface ImageState {
  url: string | null;
  text: string;
  loading: boolean;
  error?: string;
}

const Reader: React.FC<ReaderProps> = ({ data, onBack, targetLang }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [playingSide, setPlayingSide] = useState<'top' | 'bottom' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [fontScale, setFontScale] = useState(1.0);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [isSwapped, setIsSwapped] = useState(false);
  
  // Click Animation State
  const [animatingWord, setAnimatingWord] = useState<{ index: number, side: 'top' | 'bottom' } | null>(null);

  // Fallback / Quota State
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [quotaExceededUntil, setQuotaExceededUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Definition State
  const [definitionState, setDefinitionState] = useState<DefinitionState | null>(null);
  const [isLoadingDef, setIsLoadingDef] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  
  // Image Generation State (For full sentence manual trigger)
  const [imageState, setImageState] = useState<ImageState | null>(null);
  
  // Voice Control & Gamification State
  const [isListening, setIsListening] = useState(false);
  const [waitingForStartCommand, setWaitingForStartCommand] = useState(false); 
  const [celebration, setCelebration] = useState(false); 
  
  // Score States
  const [starScore, setStarScore] = useState(0); 
  const [accuracyScore, setAccuracyScore] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [currentLangTotalScore, setCurrentLangTotalScore] = useState(0);
  const [dailyStreak, setDailyStreak] = useState(0); 
  
  // Real-time word matching state
  const [matchedIndices, setMatchedIndices] = useState<Set<number>>(new Set());

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // New refs for speech history filtering
  const ignoredResultIndexRef = useRef(0);
  const currentResultLengthRef = useRef(0);

  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for Definition Logic
  const definitionCache = useRef<Map<string, string>>(new Map());
  const imageCache = useRef<Map<string, string>>(new Map()); // Cache for word illustrations
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio Logic Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordTimingsRef = useRef<{ startPct: number, endPct: number }[]>([]);
  const animationFrameRef = useRef<number>(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeWordRef = useRef<HTMLSpanElement | null>(null);

  const maxMatchedIndex = useMemo(() => {
      if (!isListening || matchedIndices.size === 0) return -1;
      return Math.max(...Array.from(matchedIndices));
  }, [matchedIndices, isListening]);

  // Auto-scroll to active item or word
  useEffect(() => {
    // Priority 1: Scroll to active word (TTS or Karaoke)
    if (activeWordRef.current) {
        const rect = activeWordRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // Check if word is outside the comfortable reading zone (middle 50%)
        const isInReadingZone = rect.top >= viewportHeight * 0.25 && rect.bottom <= viewportHeight * 0.75;
        
        if (!isInReadingZone) {
            activeWordRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
        return;
    }

    // Priority 2: Scroll to active card (Sentence)
    if (activeIndex !== null && itemRefs.current[activeIndex]) {
      if (activeIndex === 0) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
          itemRefs.current[activeIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
      }
    }
  }, [activeIndex, currentWordIndex, maxMatchedIndex]);

  // Ensure we start at the top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Fallback Refs
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // State Ref for Voice Control
  const stateRef = useRef({
      activeIndex,
      playingSide,
      isPlaying,
      isSwapped,
      data,
      celebration,
      waitingForStartCommand,
      dailyStreak,
      matchedIndices
  });

  useEffect(() => {
      stateRef.current = { activeIndex, playingSide, isPlaying, isSwapped, data, celebration, waitingForStartCommand, dailyStreak, matchedIndices };
  }, [activeIndex, playingSide, isPlaying, isSwapped, data, celebration, waitingForStartCommand, dailyStreak, matchedIndices]);

  // Load Streak & Score on Mount/Change
  useEffect(() => {
    const storedStreak = parseInt(localStorage.getItem('nt2_daily_streak') || '0', 10);
    setDailyStreak(storedStreak);
    loadCurrentLangScore();
  }, [isSwapped, targetLang]);

  const loadCurrentLangScore = () => {
      const activeLangCode = !isSwapped ? 'nl' : (targetLang || 'unknown');
      try {
          const scores = JSON.parse(localStorage.getItem('nt2_scores') || '{}');
          setCurrentLangTotalScore(scores[activeLangCode] || 0);
      } catch (e) {
          console.error("Error loading scores", e);
      }
  };



  useEffect(() => {
      isListeningRef.current = isListening;
      if (!isListening) {
          setMatchedIndices(new Set());
          setWaitingForStartCommand(false);
          if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
          if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
          
          // Reset speech cursors
          ignoredResultIndexRef.current = 0;
          currentResultLengthRef.current = 0;
      } else {
          stopAudio(true);
      }
  }, [isListening]);

  // When activeIndex changes (new sentence), reset the speech matching cursor
  useEffect(() => {
    if (isListening) {
        ignoredResultIndexRef.current = currentResultLengthRef.current;
        setMatchedIndices(new Set());
    }
  }, [activeIndex, isListening]);

  useEffect(() => {
    return () => {
      stopAudio(true);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
      stopListening();
    };
  }, []);

  useEffect(() => {
    stopAudio(true);
  }, [isSwapped]);

  useEffect(() => {
    if (audioRef.current) {
         audioRef.current.playbackRate = playbackRate;
         // Restart to ensure sync
         audioRef.current.currentTime = 0;
         setCurrentWordIndex(-1);
    }
  }, [playbackRate]);

  // Timer Effect for Quota
  useEffect(() => {
    if (!quotaExceededUntil) return;

    const interval = setInterval(() => {
        const remaining = Math.ceil((quotaExceededUntil - Date.now()) / 1000);
        
        if (remaining <= 0) {
            setQuotaExceededUntil(null);
            setIsFallbackMode(false);
            setCountdown(0);
            clearInterval(interval);
        } else {
            setCountdown(remaining);
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [quotaExceededUntil]);

  // --- STREAK LOGIC ---
  const updateDailyStreakLogic = () => {
    const STORAGE_KEY_STREAK = 'nt2_daily_streak';
    const STORAGE_KEY_DATE = 'nt2_last_activity_date';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDateStr = localStorage.getItem(STORAGE_KEY_DATE);
    let currentStreak = parseInt(localStorage.getItem(STORAGE_KEY_STREAK) || '0', 10);

    if (!lastDateStr) {
        currentStreak = 1;
        localStorage.setItem(STORAGE_KEY_STREAK, '1');
        localStorage.setItem(STORAGE_KEY_DATE, today.toISOString());
        setDailyStreak(1);
        return;
    }

    const lastDate = new Date(lastDateStr);
    const lastDateMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    const diffTime = today.getTime() - lastDateMidnight.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

    if (diffDays === 0) {
        setDailyStreak(currentStreak);
        return;
    }

    let newStreak = 1;
    if (diffDays === 1) {
        newStreak = currentStreak + 1;
    } else if (today.getDay() === 1) { 
        const dayOfWeekLast = lastDateMidnight.getDay();
        if (diffDays <= 3 && (dayOfWeekLast === 5 || dayOfWeekLast === 6 || dayOfWeekLast === 0)) {
            newStreak = currentStreak + 1;
        }
    }

    localStorage.setItem(STORAGE_KEY_STREAK, newStreak.toString());
    localStorage.setItem(STORAGE_KEY_DATE, today.toISOString());
    setDailyStreak(newStreak);
  };

  const updateLanguageScore = (points: number) => {
      const activeLangCode = !isSwapped ? 'nl' : (targetLang || 'unknown');
      const STORAGE_KEY_SCORES = 'nt2_scores';
      
      try {
          const currentScores = JSON.parse(localStorage.getItem(STORAGE_KEY_SCORES) || '{}');
          const oldScore = currentScores[activeLangCode] || 0;
          const newScore = oldScore + points;
          currentScores[activeLangCode] = newScore;
          localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(currentScores));
          setCurrentLangTotalScore(newScore);
      } catch (e) {
          console.error("Could not save score", e);
      }
  };

  // Voice Control Logic
  const toggleListening = () => {
      if (isListening) {
          stopListening();
      } else {
          if (activeIndex === null) setActiveIndex(0);
          startListening();
      }
  };

  const startListening = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
          alert("Spraakherkenning wordt niet ondersteund in deze browser.");
          return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.lang = !isSwapped ? 'nl-NL' : WEB_SPEECH_LANGS[targetLang || TargetLanguage.ENGLISH];
      recognition.continuous = true;
      recognition.interimResults = true; 

      recognition.onresult = (event: any) => {
          let currentSentenceTranscript = '';
          currentResultLengthRef.current = event.results.length;

          for (let i = ignoredResultIndexRef.current; i < event.results.length; ++i) {
             currentSentenceTranscript += event.results[i][0].transcript;
          }
          
          const fullCommandTranscript = currentSentenceTranscript.trim().toLowerCase();
          
          if (fullCommandTranscript.length > 0) {
              processSpeechInput(fullCommandTranscript);
          }
      };

      recognition.onerror = (event: any) => {
          console.error("Speech error", event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
              setIsListening(false);
              isListeningRef.current = false;
              alert("Microfoon toegang is nodig om mee te lezen.");
          }
      };

      recognition.onend = () => {
          if (isListeningRef.current && recognitionRef.current) {
              try { recognition.start(); } catch(e) {}
          }
      };

      try {
          ignoredResultIndexRef.current = 0;
          currentResultLengthRef.current = 0;
          
          recognition.start();
          recognitionRef.current = recognition;
          setIsListening(true);
          setWaitingForStartCommand(true); 
          setMatchedIndices(new Set());
      } catch(e) {
          console.error(e);
      }
  };

  const getLangCode = (side: 'top' | 'bottom') => {
      const isDutch = (side === 'top' && !isSwapped) || (side === 'bottom' && isSwapped);
      if (isDutch) return 'nl-NL';
      
      if (targetLang) {
          const normalized = targetLang.toLowerCase();
          if (normalized === 'zh' || normalized === 'cn') return 'zh-CN';
          if (WEB_SPEECH_LANGS[targetLang]) return WEB_SPEECH_LANGS[targetLang];
      }
      return 'en-US';
  };

  const normalizeWord = (w: string) => w.toLowerCase().replace(/[.,?!":;()]/g, '');

  const tokenizeText = (text: string, langCode: string) => {
      // Robust check: if langCode says Chinese OR if text contains Chinese characters
      if (langCode.startsWith('zh') || /[\u4e00-\u9fa5]/.test(text)) {
          // Match Chinese chars, Latin words, or other non-whitespace sequences
          const regex = /[\u4e00-\u9fa5]|[a-zA-Z0-9]+|[^\s\u4e00-\u9fa5a-zA-Z0-9]+/g;
          return text.match(regex) || [];
      }
      return text.trim().split(/\s+/);
  };

  const processSpeechInput = (transcript: string) => {
      const { waitingForStartCommand, activeIndex, data, celebration, matchedIndices: prevMatched } = stateRef.current;

      if (celebration) return;

      if (waitingForStartCommand) {
          if (transcript.includes("start") || transcript.includes("begin") || transcript.includes("go") || transcript.includes("ga")) {
              setWaitingForStartCommand(false);
              setMatchedIndices(new Set()); 
          }
          return;
      }

      if (activeIndex === null || !data[activeIndex]) return;

      if (transcript.includes("volgende")) {
          advanceToNextLevel();
          return;
      }

      const targetText = !isSwapped ? data[activeIndex].nl : data[activeIndex].tr;
      
      // Robust language code detection
      let langCode = 'en-US';
      if (!isSwapped) {
          langCode = 'nl-NL';
      } else {
          const tLang = targetLang || TargetLanguage.ENGLISH;
          const normalized = tLang.toLowerCase();
          if (normalized === 'zh' || normalized === 'cn') {
              langCode = 'zh-CN';
          } else if (WEB_SPEECH_LANGS[tLang]) {
              langCode = WEB_SPEECH_LANGS[tLang];
          }
      }
      
      const targetWords = tokenizeText(targetText, langCode);
      const spokenWords = tokenizeText(transcript, langCode).map(normalizeWord).filter(w => w.length > 0);
      
      const newMatched = new Set<number>();
      let spokenIndex = 0;
      let lastMatchedTargetIndex = -1; // Cursor for continuity tracking

      targetWords.forEach((word, tIndex) => {
          const cleanTarget = normalizeWord(word);
          if (cleanTarget.length === 0) return;

          // --- CONTINUITY / GAP LOGIC ---
          // Prevent matching duplicate words far ahead in the sentence.
          // We only allow a match if it is within a reasonable distance (skip count) from the last match.
          // 1 = adjacent. 4 = skip 3 words.
          const maxSkip = 3; 

          if (lastMatchedTargetIndex === -1) {
              // At start of sentence, allow match within first few words
              if (tIndex > maxSkip) return;
          } else {
              // During sentence, check distance from last match
              if ((tIndex - lastMatchedTargetIndex) > maxSkip) return;
          }

          // Strict sequential matching
          let foundIndex = -1;
          for(let i = spokenIndex; i < spokenWords.length; i++) {
              if (normalizeWord(spokenWords[i]) === cleanTarget) {
                  foundIndex = i;
                  break;
              }
          }

          if (foundIndex !== -1) {
              newMatched.add(tIndex);
              spokenIndex = foundIndex + 1; 
              lastMatchedTargetIndex = tIndex;
          }
      });

      setMatchedIndices(newMatched);

      const totalWords = targetWords.filter(w => normalizeWord(w).length > 0).length;
      const matchedCount = newMatched.size;
      const percentage = totalWords > 0 ? (matchedCount / totalWords) * 100 : 0;

      // DELAYED TRIGGER LOGIC (Debounce)
      if (percentage > 85) {
          if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
          
          celebrationTimeoutRef.current = setTimeout(() => {
             triggerCelebration(percentage);
          }, 1500);
      }
  };

  const triggerCelebration = (percentage: number) => {
      let stars = 1;
      let points = 1;
      
      if (percentage >= 98) { stars = 5; points = 5; }
      else if (percentage >= 90) { stars = 4; points = 4; }
      else if (percentage >= 75) { stars = 3; points = 3; }
      else if (percentage >= 50) { stars = 2; points = 2; }
      
      setStarScore(stars);
      setAccuracyScore(Math.round(percentage));
      setEarnedPoints(points);
      
      updateDailyStreakLogic();
      updateLanguageScore(points); 

      setCelebration(true);
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
  };

  const advanceToNextLevel = () => {
      setCelebration(false);
      setMatchedIndices(new Set());
      
      const { activeIndex, data } = stateRef.current;
      const nextIndex = (activeIndex ?? -1) + 1;

      if (nextIndex < data.length) {
          setActiveIndex(nextIndex);
          setPlayingSide('top');
          setWaitingForStartCommand(true); 
      } else {
          setWaitingForStartCommand(false);
      }
  };

  const stopListening = () => {
      setIsListening(false);
      setWaitingForStartCommand(false);
      setMatchedIndices(new Set());
      isListeningRef.current = false;
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
      if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
      }
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
  };

  const stopAudio = (resetPause: boolean = false) => {
    if (audioRef.current) {
        audioRef.current.pause();
        if (resetPause) audioRef.current = null;
    }
    if (synthRef.current) {
        synthRef.current.cancel();
    }
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
    if (resetPause) {
      setIsPaused(false);
      setCurrentWordIndex(-1);
      setPlayingSide(null);
    }
  };

  const activateFallbackMode = () => {
      if (!isFallbackMode) {
          setIsFallbackMode(true);
          const cooldown = 60 * 1000;
          setQuotaExceededUntil(Date.now() + cooldown);
          setCountdown(60);
      }
  };

  const calculateWordTimings = (text: string, langCode: string) => {
      const words = tokenizeText(text, langCode);
      const isChinese = langCode.startsWith('zh');
      
      const getWeightedLength = (word: string) => {
          if (isChinese && /[\u4e00-\u9fa5]/.test(word)) return 1; // Simple weight for Chinese chars
          let len = word.length + 15; // High base weight to stabilize short words
          // Minimal punctuation weight to prevent "jumping ahead"
          if (/[.?!]/.test(word)) len += 2; 
          else if (/[,;:]/.test(word)) len += 1; 
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



  const handleGlobalPlay = () => {
      if (isPlaying) {
          stopAudio(true);
          return;
      }
      
      const indexToPlay = activeIndex ?? 0;
      const item = data[indexToPlay];
      const side = playingSide || 'top';
      const text = side === 'top' ? (isSwapped ? item.tr : item.nl) : (isSwapped ? item.nl : item.tr);

      if (activeIndex !== indexToPlay) {
          setActiveIndex(indexToPlay);
          setPlayingSide(side);
      }

      togglePlay(indexToPlay, text, side);
  };

  const togglePlay = async (index: number, text: string, side: 'top' | 'bottom') => {
    if (isListening) {
        if (index !== activeIndex) {
            setActiveIndex(index);
            setPlayingSide(side);
            setMatchedIndices(new Set());
            setWaitingForStartCommand(true); 
        }
        return; 
    }

    if (index !== activeIndex) {
        setMatchedIndices(new Set());
    }

    const langCode = getLangCode(side);

    if (activeIndex === index && playingSide === side) {
      if (isPlaying) {
        if (audioRef.current) audioRef.current.pause();
        else synthRef.current.cancel();
        setIsPlaying(false);
        setIsPaused(true);
      } else {
        if (isFallbackMode) {
             playFallback(text, langCode, currentWordIndex > 0 ? currentWordIndex : 0);
        } else if (audioRef.current) {
             audioRef.current.play();
             startSyncLoop(audioRef.current);
             setIsPlaying(true);
             setIsPaused(false);
        } else {
             playGeminiAudio(text, langCode);
        }
      }
      return;
    }

    stopAudio(true);
    setActiveIndex(index);
    setPlayingSide(side);

    if (isFallbackMode) {
        playFallback(text, langCode);
        return;
    }

    await playGeminiAudio(text, langCode);
  };

  const startSyncLoop = (audio: HTMLAudioElement) => {
      const update = () => {
          if (audio.paused || audio.ended) return;
          const progress = audio.currentTime / audio.duration;
          if (isFinite(progress)) {
              const idx = wordTimingsRef.current.findIndex(t => progress >= t.startPct && progress < t.endPct);
              if (idx !== -1) setCurrentWordIndex(idx);
              else if (progress >= 1) setCurrentWordIndex(-1);
          }
          animationFrameRef.current = requestAnimationFrame(update);
      };
      animationFrameRef.current = requestAnimationFrame(update);
  };

  const playGeminiAudio = async (text: string, langCode: string, startTimeOffset: number = 0) => {
      // Gemini TTS currently has issues with Chinese (500 Internal Error).
      // Fallback to browser TTS for Chinese.
      if (langCode.startsWith('zh')) {
          playFallback(text, langCode);
          return;
      }

      setIsLoadingAudio(true);
      try {
          const audioBase64 = await synthesizeSpeech(text, langCode);
          const wavUrl = createWavUrl(audioBase64);
          const audio = new Audio(wavUrl);
          audio.playbackRate = playbackRate;
          wordTimingsRef.current = calculateWordTimings(text, langCode);
          
          audio.onended = () => {
              setIsPlaying(false);
              setCurrentWordIndex(-1);
              if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          };
          
          audio.onplay = () => startSyncLoop(audio);
          
          audio.onloadedmetadata = () => {
             if (startTimeOffset > 0) audio.currentTime = startTimeOffset;
             audio.play().then(() => { setIsPlaying(true); setIsPaused(false); }).catch(e => console.error(e));
          };
          
          if (audio.readyState >= 1) {
               audio.play().catch(e => console.error(e));
               setIsPlaying(true);
               setIsPaused(false);
          }
          
          audioRef.current = audio;
      } catch (err) {
          console.warn("Cloud Audio failed, switching to fallback", err);
          activateFallbackMode();
          playFallback(text, langCode); 
      } finally {
          setIsLoadingAudio(false);
      }
  };

  const playFallback = (text: string, langCode: string, wordOffset: number = 0) => {
    stopAudio(false); 
    
    if (!window.speechSynthesis) {
        alert("Je browser ondersteunt geen spraak.");
        return;
    }

    // For Chinese, insert spaces between tokens to force the TTS engine 
    // to treat each character/token as a separate word.
    const isChinese = langCode.startsWith('zh') || /[\u4e00-\u9fa5]/.test(text);
    const tokens = tokenizeText(text, langCode);
    const textToSpeak = isChinese ? tokens.join(' ') : text;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = langCode;
    utterance.rate = playbackRate * 0.9;
    
    // Explicitly try to find a matching voice
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang === langCode) || voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    if (voice) {
        utterance.voice = voice;
    }
    
    utterance.onboundary = (event) => {
        if (event.name === 'word') {
             const charIndex = event.charIndex;
             // Calculate word index based on preceding text
             const precedingText = textToSpeak.slice(0, charIndex).trim();
             const localWordIndex = precedingText.length > 0 ? precedingText.split(/\s+/).length : 0;
             setCurrentWordIndex(wordOffset + localWordIndex);
        }
    };

    utterance.onend = () => {
        setIsPlaying(false);
        setCurrentWordIndex(-1);
        utteranceRef.current = null;
    };

    utterance.onerror = (e) => {
        console.error("Speech synthesis error", e);
        setIsPlaying(false);
        utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const triggerDefinition = async (word: string, context: string, sIndex: number, wIndex: number, side: 'top' | 'bottom') => {
      if (quotaExceededUntil) return;

      if (definitionState?.word === word && definitionState?.sentenceIndex === sIndex && definitionState.wordIndex === wIndex) return;
      
      const cacheKey = `${word.toLowerCase()}-${targetLang || 'nl'}`;
      
      const cachedDef = definitionCache.current.get(cacheKey);
      const cachedImg = imageCache.current.get(word.toLowerCase()); // Image cache key remains just the word
      
      setDefinitionState({
          word,
          text: cachedDef || '',
          sentenceIndex: sIndex,
          wordIndex: wIndex,
          side,
          imageUrl: cachedImg
      });

      if (cachedDef && cachedImg) return;

      if (!cachedDef) setIsLoadingDef(true);
      if (!cachedImg) setIsLoadingImage(true);

      try {
          // Fetch definition if needed
          if (!cachedDef) {
              const def = await getWordDefinition(word, context, targetLang);
              definitionCache.current.set(cacheKey, def);
              setDefinitionState(prev => {
                  if (prev && prev.word === word && prev.sentenceIndex === sIndex && prev.wordIndex === wIndex) {
                      return { ...prev, text: def };
                  }
                  return prev;
              });
              setIsLoadingDef(false);
          }

          // Fetch Image if needed (Lazy load)
          if (!cachedImg) {
               try {
                   const img = await generateIllustration(word);
                   imageCache.current.set(cacheKey, img);
                   setDefinitionState(prev => {
                      if (prev && prev.word === word && prev.sentenceIndex === sIndex && prev.wordIndex === wIndex) {
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

  const handleWordHover = (sentenceIndex: number, text: string, side: 'top' | 'bottom', wordIndex: number) => {
      if (quotaExceededUntil) return;

      const langCode = getLangCode(side);
      const words = tokenizeText(text, langCode);
      const clickedWord = words[wordIndex]?.replace(/[.,?!":;()]/g, '');
      
      if (!clickedWord) return;

      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      
      hoverTimeoutRef.current = setTimeout(() => {
          triggerDefinition(clickedWord, text, sentenceIndex, wordIndex, side);
      }, 700);
  };

  const handleWordLeave = () => {
      if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
      }
  };

  const handleWordClick = async (sentenceIndex: number, text: string, side: 'top' | 'bottom', wordIndex: number) => {
    // TRIGGER ANIMATION
    setAnimatingWord({ index: wordIndex, side });
    setTimeout(() => setAnimatingWord(null), 300); 

    const langCode = getLangCode(side);
    const words = tokenizeText(text, langCode);
    const clickedWord = words[wordIndex]?.replace(/[.,?!":;()]/g, '');
    
    if (clickedWord) {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        if (!quotaExceededUntil) {
           triggerDefinition(clickedWord, text, sentenceIndex, wordIndex, side);
        }
    }

    if (isListening) {
        if (activeIndex !== sentenceIndex) {
            setActiveIndex(sentenceIndex);
            setPlayingSide(side);
            setWaitingForStartCommand(true); 
        }
        return;
    }

    if (isFallbackMode) {
        stopAudio(true);
        setActiveIndex(sentenceIndex);
        setPlayingSide(side);
        playFallback(words.slice(wordIndex).join(' '), langCode, wordIndex);
        return;
    }

    if (activeIndex !== sentenceIndex || playingSide !== side || !audioRef.current) {
        stopAudio(true);
        setActiveIndex(sentenceIndex);
        setPlayingSide(side);
        
        setIsLoadingAudio(true);
        try {
            const audioBase64 = await synthesizeSpeech(text, langCode);
            const wavUrl = createWavUrl(audioBase64);
            
            const audio = new Audio(wavUrl);
            audio.playbackRate = playbackRate;
            wordTimingsRef.current = calculateWordTimings(text);
            
            audio.onended = () => {
                setIsPlaying(false);
                setCurrentWordIndex(-1);
            };
            
            await audio.play();
            
            if (wordTimingsRef.current[wordIndex]) {
                 audio.currentTime = wordTimingsRef.current[wordIndex].startPct * audio.duration;
            }
            
            startSyncLoop(audio);
            setIsPlaying(true);
            setIsPaused(false);
            audioRef.current = audio;
            
        } catch (e) {
            activateFallbackMode();
            playFallback(text, langCode);
        } finally {
            setIsLoadingAudio(false);
        }
    } else {
        if (audioRef.current && wordTimingsRef.current[wordIndex]) {
            audioRef.current.currentTime = wordTimingsRef.current[wordIndex].startPct * audioRef.current.duration;
            if (!isPlaying) {
                audioRef.current.play();
                startSyncLoop(audioRef.current);
                setIsPlaying(true);
                setIsPaused(false);
            }
        }
    }
  };

  const handleGenerateImage = async (text: string) => {
      if (quotaExceededUntil) return;
      
      setImageState({ url: null, text, loading: true });
      try {
          const url = await generateIllustration(text);
          setImageState({ url, text, loading: false });
      } catch (e) {
          setImageState({ url: null, text, loading: false, error: "Kon afbeelding niet laden." });
      }
  };

  const FlagIcon = ({ code, customUrl, className = "w-6 h-4" }: { code: string, customUrl?: string, className?: string }) => {
    if (customUrl) {
      return (
        <img 
          src={customUrl} 
          alt={code} 
          className={`object-cover rounded-sm shadow-sm inline-block ${className}`} 
        />
      );
    }
    return (
      <img 
        src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} 
        srcSet={`https://flagcdn.com/w80/${code.toLowerCase()}.png 2x`}
        alt={code} 
        className={`object-cover rounded-sm shadow-sm inline-block ${className}`} 
      />
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto font-body relative">
      
      {/* CELEBRATION OVERLAY */}
      {celebration && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setCelebration(false)} />
              <div className="relative bg-white p-6 sm:p-10 rounded-[3rem] shadow-2xl border-4 border-[#8DBF45] transform animate-bounce-in flex flex-col items-center gap-6 text-center w-full max-w-lg">
                  
                  <button 
                    onClick={() => setCelebration(false)}
                    className="absolute top-4 right-4 bg-red-100 text-red-500 p-2 rounded-full hover:bg-red-200 transition-colors"
                  >
                      <X className="w-6 h-6" />
                  </button>

                  <div className="flex gap-4 mt-2">
                      <PartyPopper className="w-16 h-16 text-yellow-400 animate-bounce" />
                      <Trophy className="w-16 h-16 text-[#005B8C] animate-pulse" />
                  </div>
                  
                  <div>
                    <h2 className="text-4xl font-heading text-[#8DBF45] drop-shadow-sm mb-1">
                        {starScore === 5 ? "Fantastisch!" : starScore >= 3 ? "Goed Gedaan!" : "Goed Geprobeerd!"}
                    </h2>
                    <p className="text-[#005B8C] font-bold text-lg">
                        {starScore === 5 ? "Je leest als een kampioen!" : "Blijf zo oefenen!"}
                    </p>
                  </div>
                  
                  {/* METRICS GRID */}
                  <div className="grid grid-cols-3 gap-4 w-full">
                      {/* SENTENCE SCORE */}
                      <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200 flex flex-col items-center">
                          <span className="text-xs font-bold text-yellow-600 uppercase mb-1">Zinscore</span>
                          <div className="flex text-yellow-400">
                             {[...Array(5)].map((_, i) => (
                                 <Star key={i} className={`w-3 h-3 ${i < starScore ? 'fill-current' : 'text-gray-200'}`} />
                             ))}
                          </div>
                          <span className="text-2xl font-heading text-yellow-500 mt-1">+{earnedPoints}</span>
                      </div>

                      {/* PRONUNCIATION */}
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 flex flex-col items-center">
                           <span className="text-xs font-bold text-blue-600 uppercase mb-1">Uitspraak</span>
                           <Target className="w-6 h-6 text-blue-400 mb-1" />
                           <span className="text-2xl font-heading text-blue-500">{accuracyScore}%</span>
                      </div>

                      {/* STREAK */}
                      <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 flex flex-col items-center">
                           <span className="text-xs font-bold text-orange-600 uppercase mb-1">Streak</span>
                           <Flame className="w-6 h-6 text-orange-500 mb-1 animate-pulse" />
                           <span className="text-2xl font-heading text-orange-500">{dailyStreak}d</span>
                      </div>
                  </div>

                  {/* TOTAL LANGUAGE XP */}
                  <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden relative mt-2">
                      <div className="absolute inset-0 bg-gray-200"></div>
                      <div 
                        className="absolute left-0 top-0 h-full bg-[#8DBF45] transition-all duration-1000 ease-out"
                        style={{ width: '100%' }}
                      ></div>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">
                          Totaal: {currentLangTotalScore} punten
                      </div>
                  </div>

                  <button 
                    onClick={advanceToNextLevel}
                    className="w-full bg-[#8DBF45] text-white font-heading font-bold text-xl py-4 rounded-2xl shadow-lg hover:bg-[#7ca83d] transition-all transform hover:scale-105 flex items-center justify-center gap-2 mt-2"
                  >
                      Volgende Zin <ChevronRight className="w-6 h-6" />
                  </button>
              </div>
          </div>
      )}

      {/* Modern Sticky Controls Header */}
      <div className="sticky top-20 z-40 mb-8 transition-all">
        
        {/* QUOTA WARNING / FALLBACK INDICATOR */}
        {quotaExceededUntil && (
            <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-xl text-center text-sm font-bold border border-orange-200 shadow-sm flex items-center justify-center gap-2 animate-fade-in-down mb-2">
                <WifiOff className="w-4 h-4" />
                <span>AI limiet bereikt. Standaard stem actief. Reset in: {countdown}s</span>
            </div>
        )}

        <div className="bg-white/95 backdrop-blur-md p-2 pl-3 pr-3 rounded-[3rem] shadow-xl border border-gray-100 flex items-center justify-between gap-3 overflow-x-auto min-h-[4rem]">
            
            {/* Left Group: Flag, Score (Streak removed) */}
            <div className="flex items-center gap-2 flex-shrink-0 px-2">
                 {/* Flag & Score */}
                 <button 
                    onClick={() => setIsSwapped(!isSwapped)}
                    className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 hover:bg-gray-100 transition-colors"
                    title="Wissel taal"
                 >
                     <span className="text-lg filter drop-shadow-sm flex items-center">
                        {!isSwapped ? <FlagIcon code="nl" /> : (targetLang && LANGUAGE_LABELS[targetLang] ? <FlagIcon code={LANGUAGE_LABELS[targetLang].flagCode} customUrl={LANGUAGE_LABELS[targetLang].customFlagUrl} /> : '🌍')}
                     </span>
                     <ArrowUpDown className="w-3 h-3 text-gray-400" />
                     <span className="text-gray-600 font-heading font-bold text-sm">{currentLangTotalScore}</span>
                 </button>
            </div>

            {/* Right Group (Actions: Speed, Play, Mic) */}
            <div className="flex items-center gap-3 flex-shrink-0">
                {/* Font Size Slider */}
                <div className="hidden sm:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
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
                <div className="hidden sm:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
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

                {/* Main Play Button */}
                <button
                    onClick={handleGlobalPlay}
                    disabled={isListening}
                    className={`h-10 w-10 flex items-center justify-center rounded-full shadow-sm transition-transform active:scale-95 border ${
                        isPlaying 
                        ? 'bg-[#005B8C] border-[#005B8C] text-white'
                        : isListening 
                          ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-400 hover:border-[#005B8C] hover:text-[#005B8C]'
                    }`}
                    title="Start met voorlezen"
                >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                {/* Microphone / Stop Button (Pill Shape) */}
                <button
                    onClick={toggleListening}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-heading font-bold transition-all shadow-md transform active:scale-95 h-10 border-2 ${
                        isListening 
                        ? 'bg-[#ef4444] border-[#ef4444] text-white hover:bg-[#dc2626] shadow-red-100' // Red Stop State
                        : 'bg-white border-transparent hover:border-gray-200 text-[#8DBF45]' // Clean state (or could be green button)
                    }`}
                    title="Meelezen (Spraakherkenning)"
                >
                    {isListening ? (
                         <>
                            <MicOff className="w-5 h-5" />
                            <span>Stop</span>
                         </>
                    ) : (
                         <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-[#8DBF45] flex items-center justify-center text-white">
                                <Mic className="w-4 h-4" />
                             </div>
                             <span className="hidden sm:inline">Lezen</span>
                         </div>
                    )}
                </button>
            </div>
        </div>
      </div>

      {/* Sentences List */}
      <div className="space-y-6 pb-32">
        {data.map((item, index) => {
          const isActive = activeIndex === index;
          
          const topText = isSwapped ? item.tr : item.nl;
          const bottomText = isSwapped ? item.nl : item.tr;
          
          const topLangCode = getLangCode('top');
          const bottomLangCode = getLangCode('bottom');
          
          const topWords = tokenizeText(topText, topLangCode);
          const bottomWords = tokenizeText(bottomText, bottomLangCode);
          
          // In game mode, dim inactive cards more
          const opacityClass = isListening && !isActive ? 'opacity-30 grayscale-[0.8] scale-95 blur-[1px]' : 'opacity-100';

          return (
            <div
              key={index}
              ref={(el) => { itemRefs.current[index] = el; }}
              className={`w-full text-left p-6 sm:p-8 rounded-[2.5rem] border-4 transition-all duration-500 relative overflow-hidden bg-white ${opacityClass} ${
                isActive 
                  ? 'border-[#8DBF45] shadow-[0_10px_40px_-10px_rgba(141,191,69,0.5)] transform scale-[1.02] z-10 ring-4 ring-[#8DBF45]/20' 
                  : 'border-transparent shadow-sm hover:shadow-md'
              }`}
            >
              {/* GAMIFICATION OVERLAYS */}
              
              {/* 1. Instruction: Zeg Start */}
              {isActive && isListening && waitingForStartCommand && (
                  <div 
                    className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center animate-fade-in rounded-[2.5rem] cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        setWaitingForStartCommand(false);
                        setMatchedIndices(new Set());
                    }}
                  >
                      <div className="bg-[#005B8C] text-white p-6 rounded-3xl shadow-xl flex flex-col items-center gap-3 animate-bounce-in border-4 border-[#8DBF45] transform hover:scale-105 transition-transform">
                          <div className="bg-white/10 p-3 rounded-full">
                             <Mic className="w-8 h-8 animate-pulse text-[#8DBF45]" />
                          </div>
                          <div className="text-center">
                              <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Zeg hardop</p>
                              <p className="text-4xl font-heading">"START"</p>
                          </div>
                          <p className="text-xs opacity-75 mt-1 bg-black/20 px-3 py-1 rounded-full">(Of klik hier)</p>
                      </div>
                  </div>
              )}

              {/* 2. Live Badge */}
              {isActive && isListening && !waitingForStartCommand && (
                  <div className="absolute top-6 right-6 bg-red-50 text-red-500 px-3 py-1 rounded-full text-xs font-bold border border-red-100 flex items-center gap-2 animate-pulse z-30 shadow-sm">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      LUISTERT...
                  </div>
              )}

              <div className="flex flex-col lg:flex-row lg:gap-10 gap-6 relative z-10">
                
                {/* Top Text (Target Language) */}
                <div className="flex-1 flex items-start gap-3">
                  <span className="text-2xl mt-1 select-none filter drop-shadow-sm flex items-center" title={isSwapped ? 'Nederlands' : (LANGUAGE_LABELS[targetLang || TargetLanguage.ENGLISH]?.label || 'Taal')}>
                    {isSwapped ? ((targetLang && LANGUAGE_LABELS[targetLang]) ? <FlagIcon code={LANGUAGE_LABELS[targetLang].flagCode} customUrl={LANGUAGE_LABELS[targetLang].customFlagUrl} className="w-8 h-5" /> : '🌍') : <FlagIcon code="nl" className="w-8 h-5" />}
                  </span>
                  <p 
                    className="flex-1 leading-relaxed mb-2 text-gray-800 font-body transition-all duration-200"
                    style={{ fontSize: `${1.875 * fontScale}rem`, lineHeight: '1.4' }}
                  >
                    {topWords.map((word, wIndex) => {
                      const isHighlighted = definitionState?.sentenceIndex === index && definitionState?.wordIndex === wIndex && definitionState?.side === 'top';
                      
                      // Active Audio Logic (Primary)
                      const isAudioActive = isActive && playingSide === 'top' && wIndex === currentWordIndex && !isListening;
                      
                      // Approximate Progress Logic (Secondary/Passive)
                      let isApproximatePast = false;
                      
                      if (isActive && !isListening && currentWordIndex >= 0 && playingSide === 'bottom') {
                          const sourceLength = Math.max(1, bottomWords.length);
                          // Add small buffer (0.5) to currentWordIndex to smooth out the progress
                          const progress = Math.min(1, (currentWordIndex + 0.5) / sourceLength);
                          const targetIndex = Math.floor(progress * topWords.length);
                          
                          if (wIndex <= targetIndex) isApproximatePast = true;
                      }

                      // GUITAR HERO / KARAOKE MATCH LOGIC
                      const isMatchedByVoice = isActive && isListening && matchedIndices.has(wIndex);
                      const isKaraokeCursor = isActive && isListening && wIndex === maxMatchedIndex;

                      // ANIMATION STATE
                      const isAnimating = animatingWord?.side === 'top' && animatingWord?.index === wIndex && activeIndex === index;
                      
                      // Layout Adjustment for Chinese
                      const isChinese = topLangCode.startsWith('zh');
                      const isChineseChar = isChinese && /[\u4e00-\u9fa5]/.test(word);
                      const marginClass = isChineseChar ? 'mr-1' : 'mr-2';

                      return (
                      <span 
                        key={wIndex}
                        ref={(isAudioActive || isKaraokeCursor) ? activeWordRef : null}
                        onMouseEnter={() => handleWordHover(index, topText, 'top', wIndex)}
                        onMouseLeave={handleWordLeave}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleWordClick(index, topText, 'top', wIndex);
                        }}
                        className={`inline-block ${marginClass} px-2 py-0.5 rounded-xl transition-all duration-300 cursor-pointer 
                        ${
                          isMatchedByVoice
                            ? 'bg-[#8DBF45] text-white font-bold transform scale-110 shadow-md' // KARAOKE HIT
                            : isAudioActive
                                ? 'bg-[#005B8C] text-white transform scale-105 font-bold shadow-sm' // TTS Active (Primary)
                                : isActive && playingSide === 'bottom'
                                    ? isApproximatePast
                                        ? 'text-gray-900 font-medium' // Read (Dark)
                                        : 'text-gray-300' // Unread (Light)
                                    : 'text-gray-700 hover:bg-gray-100' // Default
                        }
                        ${isHighlighted ? 'ring-2 ring-[#005B8C] ring-offset-2' : ''}
                        ${isAnimating ? 'scale-125 text-[#8DBF45] font-extrabold shadow-lg bg-green-50' : ''}
                        `}
                      >
                        {word}
                      </span>
                    )})}
                  </p>
                  
                  <button
                    onClick={(e) => {
                        e.stopPropagation();
                        togglePlay(index, topText, 'top');
                    }}
                    className={`p-2 rounded-full transition-colors flex-shrink-0 mt-1 ${
                        isActive && playingSide === 'top' && (isPlaying || isLoadingAudio)
                        ? 'bg-blue-100 text-[#005B8C]' 
                        : 'hover:bg-gray-100 text-gray-400 hover:text-[#005B8C]'
                    }`}
                    title="Luister naar deze zin"
                  >
                    {isActive && playingSide === 'top' && (isPlaying || isLoadingAudio) ? <Pause className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>

                <div className="h-0.5 lg:h-auto lg:w-0.5 bg-gray-100 w-full rounded-full lg:self-stretch" />

                {/* Bottom Text */}
                <div className="flex-1 flex flex-row lg:flex-col items-center lg:items-stretch justify-between pt-2 lg:pt-0">
                  <div className="flex-1 mr-4 lg:mr-0 flex items-start gap-3 lg:mb-4">
                    <span className="text-2xl mt-1 select-none filter drop-shadow-sm flex items-center" title={!isSwapped ? 'Nederlands' : (LANGUAGE_LABELS[targetLang || TargetLanguage.ENGLISH]?.label || 'Taal')}>
                      {!isSwapped ? ((targetLang && LANGUAGE_LABELS[targetLang]) ? <FlagIcon code={LANGUAGE_LABELS[targetLang].flagCode} customUrl={LANGUAGE_LABELS[targetLang].customFlagUrl} className="w-8 h-5" /> : '🌍') : <FlagIcon code="nl" className="w-8 h-5" />}
                    </span>
                    <p 
                        className={`flex-1 leading-relaxed font-medium font-body transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-80'}`}
                        style={{ fontSize: `${1.75 * fontScale}rem`, lineHeight: '1.4' }}
                    >
                        {bottomWords.map((word, wIndex) => {
                          const isHighlighted = definitionState?.sentenceIndex === index && definitionState?.wordIndex === wIndex && definitionState?.side === 'bottom';
                          
                          // Active Audio Logic (Primary)
                          const isAudioActive = isActive && playingSide === 'bottom' && wIndex === currentWordIndex && !isListening;
                          
                          // Approximate Progress Logic (Secondary/Passive)
                          let isApproximatePast = false;
                          
                          if (isActive && !isListening && currentWordIndex >= 0 && playingSide === 'top') {
                              const sourceLength = Math.max(1, topWords.length);
                              // Add small buffer (0.5) to currentWordIndex to smooth out the progress
                              const progress = Math.min(1, (currentWordIndex + 0.5) / sourceLength);
                              const targetIndex = Math.floor(progress * bottomWords.length);
                              
                              if (wIndex <= targetIndex) isApproximatePast = true;
                          }
                          
                          // ANIMATION STATE
                          const isAnimating = animatingWord?.side === 'bottom' && animatingWord?.index === wIndex && activeIndex === index;
                          
                          // Layout Adjustment for Chinese
                          const isChinese = bottomLangCode.startsWith('zh');
                          const isChineseChar = isChinese && /[\u4e00-\u9fa5]/.test(word);
                          const marginClass = isChineseChar ? 'mr-1' : 'mr-1.5';

                          return (
                        <span 
                            key={wIndex}
                            ref={isAudioActive ? activeWordRef : null}
                            onMouseEnter={() => handleWordHover(index, bottomText, 'bottom', wIndex)}
                            onMouseLeave={handleWordLeave}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleWordClick(index, bottomText, 'bottom', wIndex);
                            }}
                            className={`inline-block ${marginClass} px-1.5 rounded-xl transition-all duration-200 cursor-pointer 
                            ${
                            isAudioActive
                                ? 'bg-[#005B8C] text-white transform scale-105 font-bold shadow-sm' // TTS Active (Primary)
                                : isActive && playingSide === 'top'
                                    ? isApproximatePast
                                        ? 'text-[#005B8C] font-medium opacity-100' // Read (Dark Blue)
                                        : 'text-[#005B8C] opacity-30' // Unread (Light Blue)
                                    : 'text-[#005B8C] hover:bg-blue-50' // Default
                            }
                            ${isHighlighted ? 'ring-2 ring-[#005B8C] ring-offset-2' : ''}
                            ${isAnimating ? 'scale-125 text-[#8DBF45] font-extrabold shadow-lg bg-green-50' : ''}
                            `}
                        >
                            {word}
                        </span>
                        )})}
                    </p>
                    
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            togglePlay(index, bottomText, 'bottom');
                        }}
                        className={`p-2 rounded-full transition-colors flex-shrink-0 mt-1 ${
                            isActive && playingSide === 'bottom' && (isPlaying || isLoadingAudio)
                            ? 'bg-blue-100 text-[#005B8C]' 
                            : 'hover:bg-gray-100 text-gray-400 hover:text-[#005B8C]'
                        }`}
                        title="Luister naar vertaling"
                    >
                        {isActive && playingSide === 'bottom' && (isPlaying || isLoadingAudio) ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-3 lg:mt-auto">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateImage(item.nl); 
                        }}
                        disabled={!!quotaExceededUntil}
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border-2 ${
                            quotaExceededUntil 
                            ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
                            : isActive
                             ? 'bg-blue-50 text-[#005B8C] border-[#005B8C] hover:bg-blue-100'
                             : 'bg-white text-gray-400 border-gray-200 hover:border-[#005B8C] hover:text-[#005B8C]'
                        }`}
                        title={quotaExceededUntil ? "Even wachten..." : "Toon Plaatje"}
                    >
                        {quotaExceededUntil ? <Lock className="w-4 h-4" /> : <ImageIcon className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={(e) => {
                        e.stopPropagation();
                        if (isActive && playingSide) {
                            togglePlay(index, playingSide === 'top' ? topText : bottomText, playingSide);
                        } else {
                            togglePlay(index, topText, 'top');
                        }
                        }}
                        className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg group ${
                        isListening
                            ? 'bg-gray-100 text-gray-300 border-2 border-gray-200 cursor-not-allowed opacity-50'
                            : (isActive && (isPlaying || (isLoadingAudio && !isPaused))
                                ? 'bg-[#005B8C] text-white hover:bg-[#004a73] hover:scale-105' 
                                : 'bg-white text-[#005B8C] border-2 border-[#005B8C] hover:bg-[#005B8C] hover:text-white hover:border-[#005B8C]')
                        }`}
                        title="Voorlezen"
                    >
                        {isActive && isLoadingAudio ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                        ) : isActive && isPlaying ? (
                        <Pause className="w-6 h-6 fill-current" />
                        ) : (
                        <Play className="w-6 h-6 fill-current ml-1" />
                        )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Full Screen Image Modal (Existing) */}
      {imageState && (
          <div 
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setImageState(null)}
          >
              <div 
                className="bg-white rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-2xl animate-fade-in-up relative border-4 border-[#005B8C]"
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="bg-[#005B8C] p-6 flex justify-between items-start text-white">
                      <div className="pr-8">
                          <span className="inline-block bg-[#8DBF45] text-xs font-heading font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                             In Beeld
                          </span>
                          <p className="font-heading text-xl leading-snug opacity-95">
                              {imageState.text}
                          </p>
                      </div>
                      <button 
                        onClick={() => setImageState(null)}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                      >
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-8 flex flex-col items-center justify-center min-h-[300px] bg-gray-50">
                      {imageState.loading ? (
                          <div className="text-center">
                              <Loader2 className="w-12 h-12 animate-spin text-[#8DBF45] mx-auto mb-4" />
                              <p className="text-gray-500 font-bold animate-pulse">Afbeelding genereren...</p>
                          </div>
                      ) : imageState.error ? (
                          <div className="text-center text-red-500">
                              <p className="font-bold mb-2">Oeps!</p>
                              <p>{imageState.error}</p>
                          </div>
                      ) : (
                          <img 
                            src={imageState.url!} 
                            alt="Generated illustration" 
                            className="w-full h-auto rounded-xl shadow-md object-contain max-h-[50vh]"
                          />
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Definition Pop-up (Updated with Image Support) */}
      {(definitionState) && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-[100] flex justify-center pointer-events-none">
            <div className="bg-white text-gray-800 p-6 sm:p-8 rounded-[2rem] shadow-2xl border-4 border-[#005B8C] w-full max-w-xl pointer-events-auto transform transition-all animate-fade-in-up">
                <div className="flex items-start justify-between">
                    <div className="flex-1 pr-6">
                        <div className="flex items-center gap-3 mb-4">
                             <span className="bg-[#8DBF45] text-white text-xs font-heading font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-2">
                                <span className="text-lg leading-none filter drop-shadow-sm flex items-center">
                                  {targetLang && LANGUAGE_LABELS[targetLang] ? <FlagIcon code={LANGUAGE_LABELS[targetLang].flagCode} customUrl={LANGUAGE_LABELS[targetLang].customFlagUrl} className="w-5 h-3.5" /> : <FlagIcon code="nl" className="w-5 h-3.5" />}
                                </span>
                                Betekenis
                             </span>
                             <h3 className="font-heading text-3xl text-[#005B8C] capitalize">
                                {definitionState.word}
                             </h3>
                        </div>
                        
                        <div className="flex gap-5 items-start">
                             {/* Illustration Container */}
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

export default Reader;