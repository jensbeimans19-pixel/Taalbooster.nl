import React, { useState, useEffect } from 'react';
import InputForm from '../../components/InputForm';
import Reader from '../../components/Reader';
import HomeMenu from '../../components/HomeMenu';
import DyslexiaReader from '../../components/DyslexiaReader';
import FlashCardPlayer from '../../components/FlashCardPlayer';
import FloatingChat from '../../components/FloatingChat';
import TaalStartPlayer from '../../components/TaalStartPlayer';
import GameCenter from '../../components/GameCenter';
import { SentencePair, TargetLanguage, AppMode, AviLevel, BADGES } from '../../types';
import { processContent, simplifyTextToAvi, extractWordsForFlash, getDemoData } from '../../services/geminiService';
import { Home, AlertTriangle, Clock, PlayCircle, Flame, Star, User, X, Save, Trash2, LogOut, Check, Trophy, Brain, Music, Image as ImageIcon, Layout, BarChart3, Gamepad2 } from 'lucide-react';

const AVATARS = [
  "https://blogger.googleusercontent.com/img/a/AVvXsEh3y4-_DppCENjj9aClEF2Q91FOIR6rXw1Q7RJBqojysak2nJI8aUwFVH-yVvROR9LEoDMMx5gE7cGug9eB3Bz2z1gRU_GvgtUptmpGIYASYkWXGgman5UGfJDEF6xNTKLHu94OL6_2njIjOgTKYbOz_bJfSh8SdUVZltPx83Gcqpd33ZJxZX62rlIm11I",
  "https://blogger.googleusercontent.com/img/a/AVvXsEjMJQNTVJbfWfWm_itx0IY5upGyS0H_obpn2ZWXFl3HsAWVQ9OkNqxeo2UswI_UwSIdNhTZS3RLZwWKQuu1GTkIrxQgfv_HbuRhAIb5zzE0q7ZKrsddgImLSSxS500gX-RApVj-HKwkkejRG1lKp302vL7NGBmpAJRt-pBAKpB_oEjHiY359g2w4ZllScQ",
  "https://blogger.googleusercontent.com/img/a/AVvXsEhoZs-CYjAdcYBj3v_0akjksAIqn50h2GZJTh7QEniLb40MVxa53d8ninrRNRVL4Sb2kLpP9HXgfX82yU0ok2twppfG5Xr47dDyxnzkDxBn1kAD9jocnEHT1pWNtyeKjEmAth0dwSYl83o9xxGViTdnkFyQMLxyqylKRUaZi3VR-4M-bY8NpvEDF8UGcTI"
];

const calculateLevelInfo = (score: number) => {
    const level = Math.floor(score / 100) + 1;
    const progress = score % 100; // 0-99
    return { level, progress };
};

const DemoWorkspace: React.FC = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [authError, setAuthError] = useState('');

  // Check verification on mount - using sessionStorage for session-only persistence
  // But user said "EVERY time you choose it", so maybe we shouldn't even check sessionStorage?
  // Let's stick to component state (false on mount) to strictly follow "EVERY time".
  // However, refreshing the page would kick them out. That's usually bad UX.
  // I'll use sessionStorage but clear it if they navigate away? 
  // No, let's just use sessionStorage so refresh works, but closing tab/browser clears it.
  useEffect(() => {
      const hasAccess = sessionStorage.getItem('demo_school_access') === 'true';
      setIsVerified(hasAccess);
  }, []);

  const handleVerify = (e: React.FormEvent) => {
      e.preventDefault();
      if (accessCode === '6021DW') {
          sessionStorage.setItem('demo_school_access', 'true');
          setIsVerified(true);
      } else {
          setAuthError('Ongeldige code. Probeer het opnieuw.');
      }
  };

  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<TargetLanguage>(TargetLanguage.ARABIC);
  
  // Stats & Profile State
  const [streak, setStreak] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [progress, setProgress] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGameCenter, setShowGameCenter] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempAvatar, setTempAvatar] = useState<string>(AVATARS[0]);

  // Quota Management
  const [quotaUntil, setQuotaUntil] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);

  // Data States
  const [nt2Data, setNt2Data] = useState<SentencePair[]>([]);
  const [dyslexiaText, setDyslexiaText] = useState<string>('');
  const [currentAvi, setCurrentAvi] = useState<string>('');
  const [flashWords, setFlashWords] = useState<string[]>([]);

  // Helper Functions
  const loadUserData = () => {
    const s = parseInt(localStorage.getItem('nt2_daily_streak') || '0', 10);
    setStreak(s);

    const storedName = localStorage.getItem('nt2_username');
    if (storedName) setUserName(storedName);

    const storedAvatar = localStorage.getItem('nt2_user_avatar');
    if (storedAvatar) setUserAvatar(storedAvatar);

    try {
        const scores = JSON.parse(localStorage.getItem('nt2_scores') || '{}');
        const total = Object.values(scores).reduce((a: any, b: any) => a + b, 0);
        setTotalScore(total as number);
        
        const { level, progress } = calculateLevelInfo(total as number);
        setLevel(level);
        setProgress(progress);
        
        const badges = JSON.parse(localStorage.getItem('nt2_badges') || '[]');
        setEarnedBadges(badges);
    } catch (e) {
        setTotalScore(0);
    }
  };

  const handleEarnStars = (amount: number) => {
    try {
        const scores = JSON.parse(localStorage.getItem('nt2_scores') || '{}');
        const current = scores['nl'] || 0;
        scores['nl'] = current + amount;
        localStorage.setItem('nt2_scores', JSON.stringify(scores));
        
        setTotalScore(prev => prev + amount);
        
        // Streak Logic
        let currentStreak = streak;
        const today = new Date().toISOString().split('T')[0];
        const lastDate = localStorage.getItem('nt2_last_activity_date');
        if (!lastDate || !lastDate.startsWith(today)) {
             currentStreak = streak + 1;
             localStorage.setItem('nt2_daily_streak', currentStreak.toString());
             localStorage.setItem('nt2_last_activity_date', new Date().toISOString());
             setStreak(currentStreak);
        }
        
        // Level & Badges
        const newTotal = totalScore + amount;
        const { level: newLevel, progress: newProgress } = calculateLevelInfo(newTotal);
        setLevel(newLevel);
        setProgress(newProgress);

        const earned = JSON.parse(localStorage.getItem('nt2_badges') || '[]');
        const newEarned = [...earned];
        let added = false;
        
        BADGES.forEach(badge => {
            if (!newEarned.includes(badge.id) && badge.condition({ score: newTotal, streak: currentStreak })) {
                newEarned.push(badge.id);
                added = true;
            }
        });
        
        if (added) {
            setEarnedBadges(newEarned);
            localStorage.setItem('nt2_badges', JSON.stringify(newEarned));
        }

    } catch (e) {
        console.error("Error saving stars", e);
    }
  };

  const handleSpendStars = (amount: number) => {
      if (totalScore < amount) return false;
      
      try {
        const scores = JSON.parse(localStorage.getItem('nt2_scores') || '{}');
        const current = scores['nl'] || 0;
        if (current >= amount) {
            scores['nl'] = current - amount;
        } else {
            scores['nl'] = (scores['nl'] || 0) - amount;
        }
        
        localStorage.setItem('nt2_scores', JSON.stringify(scores));
        setTotalScore(prev => prev - amount);
        return true;
      } catch (e) {
          return false;
      }
  };

  const handleSaveProfile = () => {
      if (tempName.trim()) {
          localStorage.setItem('nt2_username', tempName.trim());
          localStorage.setItem('nt2_user_avatar', tempAvatar);
          setUserName(tempName.trim());
          setUserAvatar(tempAvatar);
          setTempName('');
          setTempAvatar(AVATARS[0]);
      }
  };

  const handleLogout = () => {
      localStorage.removeItem('nt2_username');
      localStorage.removeItem('nt2_user_avatar');
      setUserName(null);
      setUserAvatar(null);
  };

  const handleResetProgress = () => {
      if (window.confirm("Weet je zeker dat je alle voortgang wilt wissen? Dit kan niet ongedaan worden gemaakt.")) {
          localStorage.removeItem('nt2_daily_streak');
          localStorage.removeItem('nt2_scores');
          localStorage.removeItem('nt2_last_activity_date');
          setStreak(0);
          setTotalScore(0);
          loadUserData();
      }
  };

  const reset = () => {
    setMode(AppMode.HOME);
    setStep(1);
    setNt2Data([]);
    setDyslexiaText('');
    setFlashWords([]);
    setError(null);
  };

  const handleDemoLoad = () => {
      setNt2Data(getDemoData());
      setSelectedLang(TargetLanguage.ARABIC);
      setStep(2);
      setError(null);
  };

  const handleProcess = async (text: string, file: File | null, lang: TargetLanguage, avi: AviLevel) => {
    if (quotaUntil) return;

    setLoading(true);
    setError(null);
    setSelectedLang(lang);
    
    try {
      if (mode === AppMode.NT2) {
          const results = await processContent(text, file, lang);
          if (results && results.length > 0) {
            setNt2Data(results);
            setStep(2);
          } else {
            throw new Error("Geen zinnen gevonden.");
          }
      } else if (mode === AppMode.DYSLEXIA) {
          const result = await simplifyTextToAvi(text, file, avi);
          if (result) {
              setDyslexiaText(result);
              setCurrentAvi(avi);
              setStep(2);
          } else {
              throw new Error("Kon tekst niet vereenvoudigen.");
          }
      } else if (mode === AppMode.FLASH) {
          const result = await extractWordsForFlash(text, file, avi);
          if (result && result.length > 0) {
              setFlashWords(result);
              setStep(2);
          } else {
              throw new Error("Geen woorden gevonden om te flitsen.");
          }
      }

    } catch (e: any) {
      console.error("Processing error:", e);
      const errorMessage = e?.message?.toLowerCase() || e?.toString().toLowerCase() || "";
      
      if (errorMessage.includes("quota") || errorMessage.includes("429") || errorMessage.includes("resource_exhausted")) {
        const cooldown = 60 * 1000;
        setQuotaUntil(Date.now() + cooldown);
        setTimer(60);
        setError("De AI-service is overbelast. Even wachten a.u.b.");
      } else {
        setError("Er ging iets mis. Controleer je input of bestand.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Timer Effect
  useEffect(() => {
      if (quotaUntil) {
          const interval = setInterval(() => {
              const diff = Math.ceil((quotaUntil - Date.now()) / 1000);
              if (diff <= 0) {
                  setQuotaUntil(null);
                  setTimer(0);
                  setError(null); // Clear error when timer is done
                  clearInterval(interval);
              } else {
                  setTimer(diff);
              }
          }, 1000);
          return () => clearInterval(interval);
      }
  }, [quotaUntil]);

  // Load Stats & Profile Effect
  useEffect(() => {
    loadUserData();
  }, [mode, step, showProfileModal]);

  if (!isVerified) {
      return (
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-4 border-[#005B8C] max-w-md w-full text-center animate-bounce-in">
                  <div className="w-24 h-24 bg-white rounded-2xl shadow-sm border border-gray-100 mx-auto mb-6 flex items-center justify-center p-4">
                        <img 
                            src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjAYOs64Yxc4eMYZpEZxSW_lAiOGlRGfGF6hi7pjuP2isr9X5676J5EuE9rqVuEDUy9FGRP-IMNHfYTKx1qM5Bo2zDz9OqzCKqbr8bC4FGMUKPoHLnss6IusvqbHcu-W7FZyxlz69VQUBGfnAbcQK61r3M9xbw_sk5L67Y2Z_aRNLuiVzvltoBj5cfNeG0/s800/Taalbooster%20txt%20logo%20(1).png" 
                            alt="TaalBooster Demo" 
                            className="w-full h-full object-contain"
                        />
                  </div>
                  <h1 className="text-2xl font-heading text-[#005B8C] mb-2">TaalBooster Demo</h1>
                  <p className="text-gray-500 mb-8">Voer de toegangscode in om de demo te starten.</p>
                  
                  <form onSubmit={handleVerify} className="space-y-4">
                      <input 
                        type="text" 
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                        placeholder="Toegangscode"
                        className="w-full px-6 py-4 rounded-xl border-2 border-gray-200 focus:border-[#F58220] focus:outline-none font-mono text-center text-xl uppercase tracking-widest"
                        autoFocus
                      />
                      {authError && <p className="text-red-500 font-bold text-sm">{authError}</p>}
                      
                      <button 
                        type="submit"
                        className="w-full bg-[#F58220] text-white py-4 rounded-xl font-bold hover:bg-[#d9731c] transition-colors shadow-md text-lg"
                      >
                          Start Demo
                      </button>
                  </form>
                  
                  <p className="mt-6 text-xs text-gray-400">
                      © {new Date().getFullYear()} TaalBooster • Demo Omgeving
                  </p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-[#F58220] selection:text-white relative">
      
      {/* Profile Modal */}
      {showProfileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowProfileModal(false)}>
              <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-4 border-[#005B8C] animate-bounce-in relative custom-scrollbar" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => setShowProfileModal(false)}
                    className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 z-10"
                  >
                      <X className="w-6 h-6" />
                  </button>

                  {!userName ? (
                      // Login / Register View
                      <div className="text-center max-w-md mx-auto">
                          <h3 className="text-2xl font-heading text-[#005B8C] mb-2">Wie ben jij?</h3>
                          <p className="text-gray-500 mb-6">Kies een plaatje en vul je naam in.</p>

                          {/* Avatar Selection */}
                          <div className="flex justify-center gap-4 mb-8">
                            {AVATARS.map((avatar, index) => (
                              <button
                                key={index}
                                onClick={() => setTempAvatar(avatar)}
                                className={`relative w-20 h-20 rounded-full overflow-hidden border-4 transition-all transform hover:scale-105 shadow-md ${
                                  tempAvatar === avatar 
                                    ? 'border-[#F58220] ring-4 ring-orange-100 scale-110' 
                                    : 'border-white ring-2 ring-gray-100 opacity-80 hover:opacity-100'
                                }`}
                              >
                                <img src={avatar} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                                {tempAvatar === avatar && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-[#F58220]/20">
                                    <div className="bg-white rounded-full p-1">
                                      <Check className="w-4 h-4 text-[#F58220] stroke-[4]" />
                                    </div>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                          
                          <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="Jouw naam..." 
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#F58220] focus:outline-none font-bold text-lg"
                                autoFocus
                              />
                              <button 
                                onClick={handleSaveProfile}
                                disabled={!tempName.trim()}
                                className="bg-[#F58220] text-white px-4 rounded-xl hover:bg-[#d9731c] disabled:opacity-50 transition-colors"
                              >
                                  <Save className="w-6 h-6" />
                              </button>
                          </div>
                      </div>
                  ) : (
                      // Profile Stats View
                      <div className="pt-2">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                               {/* Left Column: Identity & Actions */}
                               <div className="flex flex-col items-center text-center h-full">
                                   <div className="w-24 h-24 rounded-full overflow-hidden mb-3 shadow-md border-4 border-white ring-4 ring-orange-100 bg-white">
                               {userAvatar ? (
                                 <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                               ) : (
                                 <div className="w-full h-full bg-[#F58220] flex items-center justify-center text-white">
                                   <span className="text-3xl font-heading pt-1">{userName.charAt(0).toUpperCase()}</span>
                                 </div>
                               )}
                                   </div>
                                   <h3 className="text-2xl font-heading text-[#005B8C] mb-1">Hoi, {userName}!</h3>
                                   
                                   <div className="flex flex-col items-center gap-2 mb-6 w-full">
                                       <div className="flex items-center gap-2">
                                           <span className="bg-blue-100 text-[#005B8C] px-3 py-1 rounded-full text-sm font-bold">Niveau {level}</span>
                                       </div>
                                       <div className="w-full max-w-[200px] h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200 relative" title={`${progress}/100 XP tot volgend niveau`}>
                                           <div className="h-full bg-[#F58220] transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                       </div>
                                   </div>

                                   <div className="flex flex-col gap-2 w-full mt-auto">
                                       <button 
                                         onClick={handleLogout}
                                         className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 font-bold hover:bg-gray-50 hover:text-[#005B8C] transition-colors flex items-center justify-center gap-2 text-sm"
                                       >
                                           <LogOut className="w-4 h-4" />
                                           Naam wijzigen
                                       </button>
                                       
                                       <button 
                                         onClick={handleResetProgress}
                                         className="w-full py-2.5 rounded-xl border-2 border-red-50 text-red-300 font-bold hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-colors flex items-center justify-center gap-2 text-sm"
                                       >
                                           <Trash2 className="w-4 h-4" />
                                           Voortgang wissen
                                       </button>
                                   </div>
                               </div>

                               {/* Right Column: Stats & Badges */}
                               <div className="flex flex-col gap-6">
                                    {/* Stats */}
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-3 text-center md:text-left">Jouw voortgang</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100 flex flex-col items-center">
                                                <Flame className="w-6 h-6 text-orange-500 mb-1" />
                                                <span className="text-2xl font-heading text-gray-800">{streak}</span>
                                                <span className="text-[10px] text-orange-400 font-bold uppercase">Dagen Reeks</span>
                                            </div>
                                            <div className="bg-yellow-50 p-3 rounded-2xl border border-yellow-100 flex flex-col items-center">
                                                <Star className="w-6 h-6 text-yellow-500 mb-1" />
                                                <span className="text-2xl font-heading text-gray-800">{totalScore}</span>
                                                <span className="text-[10px] text-yellow-500 font-bold uppercase">Sterren</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Badges */}
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-3 text-center md:text-left">Jouw Badges</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {BADGES.map(badge => {
                                                const isEarned = earnedBadges.includes(badge.id);
                                                return (
                                                    <div key={badge.id} className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${isEarned ? 'bg-yellow-50 border-yellow-200 opacity-100 transform hover:scale-105' : 'bg-gray-50 border-gray-100 opacity-40 grayscale'}`} title={badge.description}>
                                                        <div className="text-2xl mb-1">{badge.icon}</div>
                                                        <span className="text-[9px] font-bold text-center text-gray-600 leading-tight">{badge.name}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                               </div>
                           </div>
                       </div>
                  )}
              </div>
          </div>
      )}

      {/* Header */}
      <header className={`py-3 shadow-sm sticky top-0 z-50 transition-colors duration-300 ${
          mode === AppMode.DYSLEXIA ? 'bg-orange-50 border-b-4 border-orange-400' :
          mode === AppMode.FLASH ? 'bg-green-50 border-b-4 border-[#8DBF45]' :
          'bg-white border-b-4 border-[#005B8C]'
      }`}>
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between relative">
          
          {/* Left: Logos */}
          <div className="flex items-center gap-3 sm:gap-4 cursor-pointer z-10" onClick={reset}>
            <img 
              src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjAYOs64Yxc4eMYZpEZxSW_lAiOGlRGfGF6hi7pjuP2isr9X5676J5EuE9rqVuEDUy9FGRP-IMNHfYTKx1qM5Bo2zDz9OqzCKqbr8bC4FGMUKPoHLnss6IusvqbHcu-W7FZyxlz69VQUBGfnAbcQK61r3M9xbw_sk5L67Y2Z_aRNLuiVzvltoBj5cfNeG0/s800/Taalbooster%20txt%20logo%20(1).png" 
              alt="TaalBooster" 
              className="h-8 sm:h-10 w-auto object-contain"
            />
            <div className="bg-orange-100 text-[#F58220] px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border border-orange-200">Demo</div>
          </div>

          {/* Center: GLOBAL STATS BADGE (Only if user has stats) */}
          {(streak > 0 || totalScore > 0) && (
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0 w-full flex justify-center pointer-events-none">
                <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-100 shadow-sm animate-fade-in pointer-events-auto cursor-pointer hover:scale-105 transition-transform" onClick={() => setShowProfileModal(true)}>
                     {/* Level */}
                     <div className="flex items-center gap-1.5" title="Huidig Niveau">
                        <div className="bg-blue-100 p-1 rounded-full">
                            <Trophy className="w-4 h-4 text-blue-500 fill-blue-500" />
                        </div>
                        <span className="font-heading font-bold text-blue-600 text-sm sm:text-base">{level}</span>
                     </div>

                     <div className="w-px h-4 bg-gray-200"></div>

                     {/* Streak */}
                     <div className="flex items-center gap-1.5" title="Dagen op rij">
                        <div className="bg-orange-100 p-1 rounded-full">
                            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                        </div>
                        <span className="font-heading font-bold text-orange-600 text-sm sm:text-base">{streak}</span>
                     </div>
                     
                     <div className="w-px h-4 bg-gray-200"></div>

                     {/* Total Score */}
                     <div className="flex items-center gap-1.5" title="Totaal Punten">
                        <div className="bg-yellow-100 p-1 rounded-full">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        </div>
                        <span className="font-heading font-bold text-yellow-600 text-sm sm:text-base">{totalScore}</span>
                     </div>

                     <div className="w-px h-4 bg-gray-200"></div>

                     {/* Games Button */}
                     <button 
                        onClick={(e) => { e.stopPropagation(); setShowGameCenter(true); }}
                        className="flex items-center gap-1.5 hover:bg-purple-50 p-1 -m-1 rounded-lg transition-colors"
                        title="Speelkwartier"
                     >
                        <div className="bg-purple-100 p-1 rounded-full">
                            <Gamepad2 className="w-4 h-4 text-purple-500 fill-purple-500" />
                        </div>
                        <span className="font-heading font-bold text-purple-600 text-sm sm:text-base hidden sm:inline">Spelen</span>
                     </button>
                </div>
            </div>
          )}
          
          {/* Right: Menu & Profile */}
          <div className="z-10 flex items-center justify-end gap-3">
            {mode !== AppMode.HOME && (
                <button onClick={reset} className="flex items-center gap-2 px-3 py-2 bg-white/50 hover:bg-white rounded-full text-sm font-bold text-gray-500 hover:text-[#005B8C] transition-all border border-transparent hover:border-gray-200">
                    <Home className="w-5 h-5" />
                    <span className="hidden sm:inline">Menu</span>
                </button>
            )}
            
            <button 
                onClick={() => setShowProfileModal(true)}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all border-2 shadow-sm hover:shadow-md active:scale-95 overflow-hidden ${
                    userName 
                    ? 'bg-[#F58220] text-white border-white ring-2 ring-orange-100 p-0.5' 
                    : 'bg-white text-gray-400 border-gray-200 hover:text-[#005B8C] hover:border-[#005B8C]'
                }`}
                title={userName ? `Profiel van ${userName}` : "Inloggen"}
            >
                {userName && userAvatar ? (
                    <img src={userAvatar} alt={userName} className="w-full h-full rounded-full object-cover" />
                ) : userName ? (
                    <span className="font-heading font-bold text-lg pt-1">{userName.charAt(0).toUpperCase()}</span>
                ) : (
                    <User className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
            </button>
          </div>
        </div>
      </header>

      {/* Game Center Modal */}
      {showGameCenter && (
        <GameCenter 
            totalStars={totalScore}
            onSpendStars={handleSpendStars}
            onClose={() => setShowGameCenter(false)}
        />
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pb-12">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-r-xl flex items-center justify-between shadow-sm animate-fade-in-down">
            <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                <div className="flex-1">
                    <span className="font-bold block">Foutmelding:</span>
                    <span className="text-sm">{error}</span>
                </div>
            </div>
            {quotaUntil && mode === AppMode.NT2 && (
                 <button 
                    onClick={handleDemoLoad}
                    className="flex items-center gap-2 bg-white text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-50 shadow-sm ml-4"
                 >
                     <PlayCircle className="w-4 h-4" />
                     Probeer Demo Les
                 </button>
            )}
          </div>
        )}

        {/* MODE: HOME */}
        {mode === AppMode.HOME && (
             <HomeMenu 
                onSelectMode={(m) => setMode(m)} 
                totalStars={totalScore}
                onSpendStars={handleSpendStars}
                accentColor="#F58220"
             />
        )}

        {/* MODE: ACTIVE */}
        {mode !== AppMode.HOME && mode !== AppMode.TAALSTART && step === 1 && (
            <div className="relative">
                {/* Visual Blocker for Input Form when Quota Exceeded */}
                {quotaUntil && (
                    <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-sm rounded-[2.5rem] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl border-4 border-orange-200 max-w-md w-full">
                            <Clock className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-pulse" />
                            <h3 className="text-2xl font-heading text-gray-800 mb-2">AI is even druk</h3>
                            <p className="text-gray-500 mb-6">We wachten even tot de service weer beschikbaar is.</p>
                            <div className="text-4xl font-mono font-bold text-orange-600 bg-orange-50 py-4 rounded-xl border border-orange-100">
                                00:{timer < 10 ? `0${timer}` : timer}
                            </div>
                            {mode === AppMode.NT2 && (
                                <div className="mt-6 pt-6 border-t border-gray-100">
                                    <button 
                                        onClick={handleDemoLoad}
                                        className="w-full bg-[#005B8C] text-white py-3 rounded-xl font-bold hover:bg-[#004a73] transition-colors flex items-center justify-center gap-2"
                                    >
                                        <PlayCircle className="w-5 h-5" />
                                        Start Demo Les
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                <InputForm 
                    mode={mode} 
                    onProcess={handleProcess} 
                    isLoading={loading} 
                    accentColor="#F58220"
                />
            </div>
        )}

        {/* MODE: TAALSTART PLAYER */}
        {mode === AppMode.TAALSTART && (
            <TaalStartPlayer 
                onBack={reset}
                onEarnStars={handleEarnStars}
            />
        )}

        {/* RESULTS */}
        {mode === AppMode.NT2 && step === 2 && (
             <Reader 
                data={nt2Data} 
                onBack={() => setStep(1)} 
                targetLang={selectedLang}
             />
        )}

        {mode === AppMode.DYSLEXIA && step === 2 && (
             <DyslexiaReader 
                text={dyslexiaText} 
                aviLevel={currentAvi} 
                onBack={() => setStep(1)} 
                onEarnStars={handleEarnStars}
             />
        )}

        {mode === AppMode.FLASH && step === 2 && (
             <FlashCardPlayer 
                words={flashWords} 
                onBack={() => setStep(1)} 
                onEarnStars={handleEarnStars}
             />
        )}

      </main>

      {/* Floating Chat Assistant */}
      {mode !== AppMode.HOME && <FloatingChat />}

      {/* Footer */}
      <footer className="text-center py-4 border-t border-gray-100 mt-6 flex justify-center items-center">
        <img 
            src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEimYmYyxgO7pa79kgzvNzWJZY2dpI3nRRe8w0r8M76myK4G_BTi3HXeEc48mhv-aj3MLuYcvwsvkVNrfa43RpSVAARFktORjzX86ItsZvEDrwk9tSjh87IDMj0OdaftPywgk-WxYs9n-URVETGITmPIGDdsAiSvovaeZwOLa-MJkY4Q5H5Sa7hDI3T756c/s1200/Taalbooster%20Logo%20(1).png" 
            alt="TaalBooster" 
            className="h-24 sm:h-32 w-auto transition-all duration-300" 
        />
      </footer>
    </div>
  );
};

export default DemoWorkspace;
