import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Mic, MicOff, RotateCcw, Star, CheckCircle, Clock, ChevronRight, Trophy, AlertCircle, XCircle, Volume2, Play, Pause, Zap, MousePointerClick } from 'lucide-react';
import { synthesizeSpeech, createWavUrl } from '../services/geminiService';

interface FlashCardPlayerProps {
  words: string[];
  onBack: () => void;
  onEarnStars: (amount: number) => void;
}

type Phase = 'overview' | 'playing' | 'finished';

const FlashCardPlayer: React.FC<FlashCardPlayerProps> = ({ words, onBack, onEarnStars }) => {
  const [phase, setPhase] = useState<Phase>('overview');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Overview / Audio State
  const [overviewPlaying, setOverviewPlaying] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewHighlightIndex, setOverviewHighlightIndex] = useState(-1);
  const [singleWordLoadingIndex, setSingleWordLoadingIndex] = useState(-1);

  // Voice & Game State
  const [isListening, setIsListening] = useState(false);
  const [waitingForStart, setWaitingForStart] = useState(false);
  const [detectedText, setDetectedText] = useState(""); // Debug feedback
  
  // Results State
  const [results, setResults] = useState<{ word: string; correct: boolean }[]>([]);

  // Timer State
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Feedback State
  const [lastCorrectWord, setLastCorrectWord] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<'idle' | 'correct' | 'wrong'>('idle');

  // Refs
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // State Ref to solve Stale Closure in Event Listeners
  const stateRef = useRef({
      phase,
      waitingForStart,
      currentIndex,
      words
  });

  // Keep stateRef in sync
  useEffect(() => {
      stateRef.current = {
          phase,
          waitingForStart,
          currentIndex,
          words
      };
  }, [phase, waitingForStart, currentIndex, words]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      stopAudio();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer Logic (Only during 'playing' phase)
  useEffect(() => {
      if (phase === 'playing') {
          timerRef.current = setInterval(() => {
              setElapsedTime(prev => prev + 1);
          }, 1000);
      } else {
          if (timerRef.current) clearInterval(timerRef.current);
      }
      return () => { if (timerRef.current) clearInterval(timerRef.current); }
  }, [phase]);

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- AUDIO LOGIC (OVERVIEW PHASE) ---

  const stopAudio = () => {
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
      }
      if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
      }
      setOverviewPlaying(false);
      setOverviewHighlightIndex(-1);
      setSingleWordLoadingIndex(-1);
  };

  const calculateTimings = (text: string) => {
      // Split by ". " because we join with ". "
      // However, words might contain punctuation, so we rely on the input 'words' array length
      // and map character distribution.
      const totalChars = text.length;
      let cumulativeChars = 0;
      
      return words.map(word => {
          // The spoken text adds ". " between words usually, or just pauses.
          // Simple estimation:
          const startPct = cumulativeChars / totalChars;
          cumulativeChars += word.length + 2; // +2 for ". " approximation
          const endPct = cumulativeChars / totalChars;
          return { startPct, endPct };
      });
  };

  const handleOverviewPlay = async () => {
      if (overviewPlaying) {
          stopAudio();
          return;
      }
      
      // Stop any single word playback
      stopAudio();

      setOverviewLoading(true);
      try {
          // Join words with pause-inducing punctuation for clear separation
          const fullText = words.join('. '); 
          const audioBase64 = await synthesizeSpeech(fullText);
          const wavUrl = createWavUrl(audioBase64);
          
          const audio = new Audio(wavUrl);
          const timings = calculateTimings(fullText);

          audio.onended = () => {
              setOverviewPlaying(false);
              setOverviewHighlightIndex(-1);
              if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          };

          audio.onplay = () => {
              const update = () => {
                  if (audio.paused || audio.ended) return;
                  const progress = audio.currentTime / audio.duration;
                  
                  if (isFinite(progress)) {
                      const idx = timings.findIndex(t => progress >= t.startPct && progress < t.endPct);
                      if (idx !== -1) setOverviewHighlightIndex(idx);
                  }
                  animationFrameRef.current = requestAnimationFrame(update);
              };
              animationFrameRef.current = requestAnimationFrame(update);
          };

          audioRef.current = audio;
          await audio.play();
          setOverviewPlaying(true);

      } catch (e) {
          console.error("Overview audio failed", e);
          alert("Kon audio niet laden.");
      } finally {
          setOverviewLoading(false);
      }
  };

  const playSingleWord = async (word: string, index: number) => {
      // Stop any existing audio
      stopAudio();
      
      setSingleWordLoadingIndex(index);
      setOverviewHighlightIndex(index); // Visual highlight immediately

      try {
          const audioBase64 = await synthesizeSpeech(word);
          const wavUrl = createWavUrl(audioBase64);
          const audio = new Audio(wavUrl);

          audio.onended = () => {
              setOverviewHighlightIndex(-1);
          };
          
          audioRef.current = audio;
          await audio.play();
      } catch (e) {
          console.error("Single word audio failed", e);
          setOverviewHighlightIndex(-1);
      } finally {
          setSingleWordLoadingIndex(-1);
      }
  };

  const handleStartFlashGame = () => {
      stopAudio();
      setPhase('playing');
      setElapsedTime(0);
      setWaitingForStart(true);
      startListening();
  };


  // --- VOICE LOGIC (PLAYING PHASE) ---

  const toggleListening = () => {
      if (isListening) {
          stopListening();
      } else {
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
      recognition.lang = 'nl-NL';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
              transcript += event.results[i][0].transcript;
          }
          
          if (transcript) {
              const lower = transcript.toLowerCase().trim();
              setDetectedText(lower); 
              processSpeech(lower);
          }
      };

      recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed') {
              stopListening();
              alert("Microfoon toegang geweigerd.");
          }
      };

      recognition.onend = () => {
          if (isListeningRef.current && recognitionRef.current) {
              try { recognition.start(); } catch(e) {}
          }
      };

      try {
          recognition.start();
          recognitionRef.current = recognition;
          setIsListening(true);
          isListeningRef.current = true;
      } catch(e) {
          console.error(e);
      }
  };

  const stopListening = () => {
      setIsListening(false);
      isListeningRef.current = false;
      setWaitingForStart(false);
      if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
      }
  };

  const normalize = (s: string) => s.toLowerCase().replace(/[.,?!":;()]/g, '').trim();

  const processSpeech = (cleanTranscript: string) => {
      const { waitingForStart, phase, words, currentIndex } = stateRef.current;

      // 1. Handle "Start" command
      if (waitingForStart && phase === 'playing') {
          if (cleanTranscript.includes('start') || cleanTranscript.includes('begin')) {
              setWaitingForStart(false);
              setDetectedText("");
          }
          return;
      }

      // 2. Handle Word Matching
      if (phase === 'playing' && !waitingForStart) {
          const currentWord = normalize(words[currentIndex]);
          if (cleanTranscript.includes(currentWord)) {
              handleCorrectWord(words[currentIndex]);
          }
      }
  };

  const recordResult = (correct: boolean) => {
      const { words, currentIndex } = stateRef.current;
      setResults(prev => [...prev, { word: words[currentIndex], correct }]);
  };

  const handleCorrectWord = (word: string) => {
      setFeedbackState(prev => {
          if (prev === 'correct') return prev;
          setLastCorrectWord(word);
          setTimeout(() => {
              recordResult(true);
              advanceCard(true);
          }, 600);
          return 'correct';
      });
  };

  const advanceCard = (correct: boolean) => {
      const { words, currentIndex } = stateRef.current;
      
      if (correct && (currentIndex + 1) % 5 === 0) {
          onEarnStars(1);
      }

      if (currentIndex < words.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setFeedbackState('idle');
          setDetectedText(""); 
      } else {
          finishGame();
      }
  };

  const handleSkip = () => {
      recordResult(false);
      advanceCard(false);
  };

  const finishGame = () => {
      setPhase('finished');
      stopListening();
      onEarnStars(3); 
  };

  const reset = () => {
      stopListening();
      setPhase('overview');
      setOverviewPlaying(false);
      setCurrentIndex(0);
      setElapsedTime(0);
      setFeedbackState('idle');
      setDetectedText("");
      setResults([]);
  };

  // --- RENDER: OVERVIEW PHASE ---
  if (phase === 'overview') {
      return (
          <div className="w-full max-w-4xl mx-auto flex flex-col items-center animate-fade-in-up">
              <div className="w-full flex justify-between items-center mb-6">
                  <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                      <ArrowLeft />
                  </button>
                  <h2 className="text-2xl font-heading text-[#005B8C]">Oefenlijst</h2>
                  <div className="w-10"></div>
              </div>

              <div className="text-center mb-8">
                  <p className="text-gray-500 text-lg">
                      Luister naar de woorden of <span className="font-bold text-[#005B8C] flex items-center justify-center gap-1 inline-flex align-middle"><MousePointerClick className="w-4 h-4" /> klik</span> op een woord.
                      <br/>
                      Klik op <span className="font-bold text-[#8DBF45]">Start Flitsen</span> als je er klaar voor bent!
                  </p>
              </div>

              {/* WORD LIST GRID */}
              <div className="flex flex-wrap gap-3 justify-center mb-10 max-w-3xl">
                  {words.map((word, index) => {
                      const isActive = overviewHighlightIndex === index;
                      const isLoadingThis = singleWordLoadingIndex === index;
                      
                      return (
                          <button 
                             key={index}
                             onClick={() => playSingleWord(word, index)}
                             disabled={singleWordLoadingIndex !== -1 && !isLoadingThis} 
                             className={`px-4 py-2 rounded-xl text-lg font-bold transition-all duration-300 transform border-2 flex items-center gap-2 ${
                                 isActive 
                                 ? 'bg-[#8DBF45] text-white scale-110 shadow-lg z-10 border-[#8DBF45]' 
                                 : 'bg-white text-gray-600 border-gray-100 hover:border-[#8DBF45] hover:bg-green-50'
                             }`}
                          >
                              {word}
                              {isActive && (
                                  <Volume2 className="w-4 h-4 animate-pulse" />
                              )}
                          </button>
                      )
                  })}
              </div>

              {/* CONTROLS */}
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
                  <button 
                      onClick={handleOverviewPlay}
                      disabled={overviewLoading || singleWordLoadingIndex !== -1}
                      className={`flex-1 py-4 rounded-xl font-heading font-bold text-xl flex items-center justify-center gap-2 transition-all ${
                          overviewPlaying 
                          ? 'bg-white border-2 border-[#005B8C] text-[#005B8C]' 
                          : 'bg-[#005B8C] text-white hover:bg-[#004a73]'
                      } ${singleWordLoadingIndex !== -1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                      {overviewLoading ? "Laden..." : overviewPlaying ? (
                          <>
                            <Pause className="w-6 h-6" /> Stop Lijst
                          </>
                      ) : (
                          <>
                            <Play className="w-6 h-6" /> Speel Alles
                          </>
                      )}
                  </button>

                  <button 
                      onClick={handleStartFlashGame}
                      className="flex-1 py-4 rounded-xl font-heading font-bold text-xl bg-[#8DBF45] text-white hover:bg-[#7ca83d] flex items-center justify-center gap-2 shadow-lg transform hover:scale-105 transition-all"
                  >
                      <Zap className="w-6 h-6 fill-current" />
                      Start Flitsen
                  </button>
              </div>
          </div>
      );
  }

  // --- RENDER: FINISHED PHASE ---
  if (phase === 'finished') {
      const correctCount = results.filter(r => r.correct).length;
      const totalWords = words.length;
      const scorePercentage = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;

      return (
          <div className="w-full max-w-lg mx-auto bg-white rounded-[2.5rem] p-8 text-center shadow-2xl border-4 border-[#8DBF45] animate-bounce-in mt-10 mb-10">
               <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 drop-shadow-md animate-bounce" />
               <h2 className="text-3xl font-heading text-[#005B8C] mb-2">
                   {scorePercentage === 100 ? "Geweldig!" : scorePercentage >= 70 ? "Goed gedaan!" : "Blijf oefenen!"}
               </h2>
               <p className="text-gray-500 mb-6 text-lg">
                   Je hebt <strong>{correctCount}</strong> van de <strong>{totalWords}</strong> woorden geflitst.
               </p>

               {/* RESULTS GRID */}
               <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100 max-h-60 overflow-y-auto custom-scrollbar">
                   <div className="grid grid-cols-2 gap-2 text-left">
                       {results.map((res, idx) => (
                           <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${
                               res.correct 
                               ? 'bg-green-50 border-green-100 text-green-700' 
                               : 'bg-red-50 border-red-100 text-red-500'
                           }`}>
                               <span className="font-bold truncate mr-2">{res.word}</span>
                               {res.correct ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <XCircle className="w-5 h-5 flex-shrink-0" />}
                           </div>
                       ))}
                   </div>
               </div>

               <div className="bg-blue-50 p-4 rounded-3xl border-2 border-blue-100 mb-6 inline-block min-w-[200px]">
                   <span className="block text-blue-400 font-bold uppercase text-xs tracking-wider mb-1">Jouw Tijd</span>
                   <span className="text-4xl font-mono font-bold text-[#005B8C]">{formatTime(elapsedTime)}</span>
               </div>

               <div className="flex flex-col gap-3">
                   <button 
                       onClick={reset}
                       className="w-full py-4 rounded-xl bg-[#8DBF45] text-white font-heading font-bold text-xl hover:bg-[#7ca83d] transition-all"
                   >
                       Opnieuw Spelen
                   </button>
                   <button 
                       onClick={onBack}
                       className="w-full py-4 rounded-xl border-2 border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all"
                   >
                       Terug naar Menu
                   </button>
               </div>
          </div>
      );
  }

  // --- RENDER: PLAYING PHASE (EXISTING GAME) ---
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center relative min-h-[600px] animate-fade-in">
       
       {/* START INSTRUCTION OVERLAY */}
       {isListening && waitingForStart && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer"
            onClick={() => { setWaitingForStart(false); setDetectedText(""); }}
          >
              <div 
                className="bg-[#005B8C] text-white p-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 animate-bounce-in border-4 border-[#8DBF45] transform hover:scale-105 transition-transform"
                onClick={(e) => { e.stopPropagation(); setWaitingForStart(false); setDetectedText(""); }}
              >
                  <div className="bg-white/10 p-4 rounded-full">
                     <Mic className="w-12 h-12 animate-pulse text-[#8DBF45]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold opacity-90 uppercase tracking-widest mb-1">Zeg hardop</p>
                    <p className="text-5xl font-heading">"START"</p>
                  </div>
                  <p className="text-xs opacity-75 mt-2 bg-black/20 px-3 py-1 rounded-full">(Of klik hier)</p>
                  
                  {detectedText && (
                      <div className="mt-4 bg-black/30 px-4 py-2 rounded-lg text-sm text-gray-200">
                          Ik hoorde: "{detectedText}"
                      </div>
                  )}
              </div>
          </div>
      )}

       {/* Header */}
       <div className="w-full flex justify-between items-center mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
           <button onClick={() => { stopListening(); setPhase('overview'); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
               <ArrowLeft />
           </button>
           
           {/* Progress Dots */}
           <div className="flex gap-1">
               {words.map((_, i) => (
                   <div 
                        key={i} 
                        className={`w-2 h-2 rounded-full transition-all ${
                            i === currentIndex ? 'bg-[#005B8C] scale-125' : 
                            i < currentIndex ? 'bg-[#8DBF45]' : 'bg-gray-200'
                        }`} 
                   />
               ))}
           </div>
           
           {/* Timer */}
           <div className="flex items-center gap-2 font-mono text-xl font-bold text-gray-600 bg-gray-50 px-3 py-1 rounded-lg">
               <Clock className="w-5 h-5 text-gray-400" />
               {formatTime(elapsedTime)}
           </div>
       </div>

       {/* Flash Card Area */}
       <div className="relative w-full aspect-[4/3] sm:aspect-video mb-8 perspective-1000">
            <div 
                className={`w-full h-full bg-white rounded-[3rem] border-8 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500 transform ${
                    feedbackState === 'correct' 
                    ? 'border-[#8DBF45] scale-105 bg-green-50' 
                    : 'border-[#005B8C] bg-white'
                }`}
            >
                {/* Visual Feedback Icon */}
                {feedbackState === 'correct' && (
                    <div className="absolute top-4 right-4 animate-bounce-in">
                        <CheckCircle className="w-12 h-12 text-[#8DBF45] fill-green-100" />
                    </div>
                )}
                
                {/* The Word */}
                <h1 className={`text-6xl sm:text-8xl font-heading text-center px-4 break-words transition-all duration-300 ${
                    feedbackState === 'correct' ? 'text-[#8DBF45] scale-110' : 'text-[#005B8C]'
                }`}>
                    {words[currentIndex]}
                </h1>

                {/* Microphone Status Indicator inside card */}
                <div className={`absolute bottom-6 flex flex-col items-center gap-2 transition-all`}>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
                        isListening && !waitingForStart
                        ? 'bg-red-50 text-red-500 animate-pulse border border-red-100' 
                        : 'bg-gray-100 text-gray-400 opacity-50'
                    }`}>
                        {isListening && !waitingForStart ? (
                            <>
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                Luistert...
                            </>
                        ) : (
                            <>
                                <MicOff className="w-4 h-4" />
                                Microfoon uit
                            </>
                        )}
                    </div>
                    
                    {/* Real-time speech feedback */}
                    {isListening && detectedText && !waitingForStart && feedbackState === 'idle' && (
                        <div className="text-gray-400 text-xs mt-1 bg-white/80 px-2 py-1 rounded-lg">
                            "{detectedText}"
                        </div>
                    )}
                </div>
            </div>
       </div>

       {/* Controls */}
       <div className="w-full flex justify-center items-center gap-6">
            <button 
                onClick={() => setPhase('overview')}
                className="w-14 h-14 rounded-full bg-white border-2 border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 flex items-center justify-center transition-colors shadow-sm"
                title="Terug naar lijst"
            >
                <RotateCcw className="w-6 h-6" />
            </button>

            {/* Main Mic Button */}
            <button 
                onClick={toggleListening}
                className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white transition-all transform hover:scale-105 active:scale-95 ${
                    isListening 
                    ? 'bg-red-500 text-white shadow-red-200' 
                    : 'bg-[#8DBF45] text-white shadow-green-200'
                }`}
            >
                {isListening ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
            </button>

            {/* Skip Button (Fallback) */}
            <button 
                onClick={handleSkip}
                className="w-14 h-14 rounded-full bg-white border-2 border-[#005B8C] text-[#005B8C] hover:bg-blue-50 flex items-center justify-center transition-colors shadow-sm"
                title="Sla woord over"
            >
                <ChevronRight className="w-8 h-8 ml-1" />
            </button>
       </div>
       
       <p className="mt-8 text-gray-400 text-sm font-bold opacity-60">
           {isListening ? "Zeg het woord hardop om verder te gaan." : "Klik op de microfoon om te starten."}
       </p>
    </div>
  );
};

export default FlashCardPlayer;