import React, { useState, useRef } from 'react';
import { Gamepad2, Globe, Lock, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { TargetLanguage, LANGUAGE_LABELS } from '../types';

interface GameCenterProps {
  totalStars: number;
  onSpendStars?: (amount: number) => boolean;
  onClose: () => void;
}

interface MemoryCard {
  id: number;
  emoji: string;
  text: string;
  lang: 'nl' | TargetLanguage;
  flipped: boolean;
  matched: boolean;
  pairId: number;
}

const GAME_COST = 100;

const MEMORY_VOCABULARY = [
  { emoji: '🐶', nl: 'Hond', [TargetLanguage.ENGLISH]: 'Dog', [TargetLanguage.FRENCH]: 'Chien', [TargetLanguage.SPANISH]: 'Perro', [TargetLanguage.ARABIC]: 'كلب', [TargetLanguage.TURKISH]: 'Köpek', [TargetLanguage.UKRAINIAN]: 'Собака', [TargetLanguage.POLISH]: 'Pies', [TargetLanguage.SOMALI]: 'Eey', [TargetLanguage.GERMAN]: 'Hund' },
  { emoji: '🐱', nl: 'Kat', [TargetLanguage.ENGLISH]: 'Cat', [TargetLanguage.FRENCH]: 'Chat', [TargetLanguage.SPANISH]: 'Gato', [TargetLanguage.ARABIC]: 'قطة', [TargetLanguage.TURKISH]: 'Kedi', [TargetLanguage.UKRAINIAN]: 'Кіт', [TargetLanguage.POLISH]: 'Kot', [TargetLanguage.SOMALI]: 'Bisad', [TargetLanguage.GERMAN]: 'Katze' },
  { emoji: '🏠', nl: 'Huis', [TargetLanguage.ENGLISH]: 'House', [TargetLanguage.FRENCH]: 'Maison', [TargetLanguage.SPANISH]: 'Casa', [TargetLanguage.ARABIC]: 'منزل', [TargetLanguage.TURKISH]: 'Ev', [TargetLanguage.UKRAINIAN]: 'Дім', [TargetLanguage.POLISH]: 'Dom', [TargetLanguage.SOMALI]: 'Guri', [TargetLanguage.GERMAN]: 'Haus' },
  { emoji: '🌳', nl: 'Boom', [TargetLanguage.ENGLISH]: 'Tree', [TargetLanguage.FRENCH]: 'Arbre', [TargetLanguage.SPANISH]: 'Árbol', [TargetLanguage.ARABIC]: 'شجرة', [TargetLanguage.TURKISH]: 'Ağaç', [TargetLanguage.UKRAINIAN]: 'Дерево', [TargetLanguage.POLISH]: 'Drzewo', [TargetLanguage.SOMALI]: 'Geed', [TargetLanguage.GERMAN]: 'Baum' },
  { emoji: '☀️', nl: 'Zon', [TargetLanguage.ENGLISH]: 'Sun', [TargetLanguage.FRENCH]: 'Soleil', [TargetLanguage.SPANISH]: 'Sol', [TargetLanguage.ARABIC]: 'شمس', [TargetLanguage.TURKISH]: 'Güneş', [TargetLanguage.UKRAINIAN]: 'Сонце', [TargetLanguage.POLISH]: 'Słońce', [TargetLanguage.SOMALI]: 'Qorrax', [TargetLanguage.GERMAN]: 'Sonne' },
  { emoji: '🌙', nl: 'Maan', [TargetLanguage.ENGLISH]: 'Moon', [TargetLanguage.FRENCH]: 'Lune', [TargetLanguage.SPANISH]: 'Luna', [TargetLanguage.ARABIC]: 'قمر', [TargetLanguage.TURKISH]: 'Ay', [TargetLanguage.UKRAINIAN]: 'Місяць', [TargetLanguage.POLISH]: 'Księżyc', [TargetLanguage.SOMALI]: 'Dayax', [TargetLanguage.GERMAN]: 'Mond' },
  { emoji: '⭐', nl: 'Ster', [TargetLanguage.ENGLISH]: 'Star', [TargetLanguage.FRENCH]: 'Étoile', [TargetLanguage.SPANISH]: 'Estrella', [TargetLanguage.ARABIC]: 'نجمة', [TargetLanguage.TURKISH]: 'Yıldız', [TargetLanguage.UKRAINIAN]: 'Зірка', [TargetLanguage.POLISH]: 'Gwiazda', [TargetLanguage.SOMALI]: 'Xiddig', [TargetLanguage.GERMAN]: 'Stern' },
  { emoji: '❤️', nl: 'Hart', [TargetLanguage.ENGLISH]: 'Heart', [TargetLanguage.FRENCH]: 'Cœur', [TargetLanguage.SPANISH]: 'Corazón', [TargetLanguage.ARABIC]: 'قلب', [TargetLanguage.TURKISH]: 'Kalp', [TargetLanguage.UKRAINIAN]: 'Серце', [TargetLanguage.POLISH]: 'Serce', [TargetLanguage.SOMALI]: 'Wadnaha', [TargetLanguage.GERMAN]: 'Herz' },
  { emoji: '🍎', nl: 'Appel', [TargetLanguage.ENGLISH]: 'Apple', [TargetLanguage.FRENCH]: 'Pomme', [TargetLanguage.SPANISH]: 'Manzana', [TargetLanguage.ARABIC]: 'تفاحة', [TargetLanguage.TURKISH]: 'Elma', [TargetLanguage.UKRAINIAN]: 'Яблуко', [TargetLanguage.POLISH]: 'Jabłko', [TargetLanguage.SOMALI]: 'Tufaax', [TargetLanguage.GERMAN]: 'Apfel' },
  { emoji: '🚗', nl: 'Auto', [TargetLanguage.ENGLISH]: 'Car', [TargetLanguage.FRENCH]: 'Voiture', [TargetLanguage.SPANISH]: 'Coche', [TargetLanguage.ARABIC]: 'سيارة', [TargetLanguage.TURKISH]: 'Araba', [TargetLanguage.UKRAINIAN]: 'Автомобіль', [TargetLanguage.POLISH]: 'Samochód', [TargetLanguage.SOMALI]: 'Baabuur', [TargetLanguage.GERMAN]: 'Auto' },
  { emoji: '⚽', nl: 'Bal', [TargetLanguage.ENGLISH]: 'Ball', [TargetLanguage.FRENCH]: 'Balle', [TargetLanguage.SPANISH]: 'Pelota', [TargetLanguage.ARABIC]: 'كرة', [TargetLanguage.TURKISH]: 'Top', [TargetLanguage.UKRAINIAN]: 'М\'яч', [TargetLanguage.POLISH]: 'Piłka', [TargetLanguage.SOMALI]: 'Banooni', [TargetLanguage.GERMAN]: 'Ball' },
  { emoji: '📚', nl: 'Boek', [TargetLanguage.ENGLISH]: 'Book', [TargetLanguage.FRENCH]: 'Livre', [TargetLanguage.SPANISH]: 'Libro', [TargetLanguage.ARABIC]: 'كتاب', [TargetLanguage.TURKISH]: 'Kitap', [TargetLanguage.UKRAINIAN]: 'Книга', [TargetLanguage.POLISH]: 'Książka', [TargetLanguage.SOMALI]: 'Buug', [TargetLanguage.GERMAN]: 'Buch' },
];

const GameCenter: React.FC<GameCenterProps> = ({ totalStars, onSpendStars, onClose }) => {
  const [activeGame, setActiveGame] = useState<'menu' | 'memory'>('menu');
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [gameWon, setGameWon] = useState(false);
  const [gameLang, setGameLang] = useState<TargetLanguage>(TargetLanguage.ENGLISH);
  const [showLangMenu, setShowLangMenu] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300; // card width + gap
      scrollContainerRef.current.scrollBy({
        left: direction === 'right' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const initializeGame = (lang: TargetLanguage) => {
    const selectedPairs = [...MEMORY_VOCABULARY]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);

    const deck: MemoryCard[] = [];
    
    selectedPairs.forEach((item, index) => {
      deck.push({
        id: index * 2,
        pairId: index,
        emoji: item.emoji,
        text: item.nl,
        lang: 'nl',
        flipped: false,
        matched: false
      });
      
      deck.push({
        id: index * 2 + 1,
        pairId: index,
        emoji: item.emoji,
        text: (item as any)[lang] || '?',
        lang: lang,
        flipped: false,
        matched: false
      });
    });

    setCards(deck.sort(() => Math.random() - 0.5));
    setFlippedIndices([]);
    setGameWon(false);
  };

  const handleStartMemory = () => {
    if (onSpendStars && onSpendStars(GAME_COST)) {
      initializeGame(gameLang);
      setActiveGame('memory');
    } else {
      alert(`Je hebt ${GAME_COST} sterren nodig om te spelen!`);
    }
  };

  const handleRestartGame = () => {
    initializeGame(gameLang);
  };

  const handleLangChange = (lang: TargetLanguage) => {
    setGameLang(lang);
    initializeGame(lang);
  };

  const handleCardClick = (index: number) => {
    if (flippedIndices.length >= 2 || cards[index].flipped || cards[index].matched) return;

    const newCards = [...cards];
    newCards[index].flipped = true;
    setCards(newCards);
    
    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped;
      if (newCards[first].pairId === newCards[second].pairId) {
        newCards[first].matched = true;
        newCards[second].matched = true;
        setCards(newCards);
        setFlippedIndices([]);
        
        if (newCards.every(c => c.matched)) {
          setTimeout(() => setGameWon(true), 500);
        }
      } else {
        setTimeout(() => {
          const resetCards = [...cards];
          resetCards[first].flipped = false;
          resetCards[second].flipped = false;
          setCards(resetCards);
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] p-6 max-w-4xl w-full shadow-2xl relative border-4 sm:border-8 border-purple-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-red-100 hover:bg-red-200 text-red-500 p-2 rounded-full shadow-md transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {activeGame === 'menu' ? (
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-heading text-purple-600 mb-2">Speelkwartier</h2>
            <p className="text-gray-500 mb-8">Kies een spelletje om te spelen!</p>
            
            <div className="relative group px-4">
                {/* Scroll Buttons */}
                <button 
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white p-3 rounded-full shadow-lg border border-gray-100 text-gray-400 hover:text-purple-600 hover:scale-110 transition-all hidden md:flex items-center justify-center"
                    aria-label="Scroll Left"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>

                <button 
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white p-3 rounded-full shadow-lg border border-gray-100 text-gray-400 hover:text-purple-600 hover:scale-110 transition-all hidden md:flex items-center justify-center"
                    aria-label="Scroll Right"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>

                <div 
                    ref={scrollContainerRef}
                    className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 px-4 scrollbar-modern scroll-smooth"
                >
                    {/* Memory Game Tile */}
                    <button
                        onClick={handleStartMemory}
                        disabled={totalStars < GAME_COST}
                        className={`flex-shrink-0 snap-center w-72 group relative bg-purple-50 rounded-3xl p-6 text-left border-4 border-transparent hover:border-purple-500 transition-all duration-300 flex flex-col h-80 ${totalStars < GAME_COST ? 'opacity-75' : ''}`}
                    >
                        <div className="bg-purple-500 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-white shadow-md">
                        <Gamepad2 className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-heading text-purple-700 mb-2">Woord Memory</h3>
                        <p className="text-gray-500 text-base mb-4 flex-grow">
                        Zoek de juiste paren bij elkaar.
                        </p>
                        <div className="mt-auto">
                        {totalStars >= GAME_COST ? (
                            <span className="inline-flex items-center px-4 py-2 rounded-full bg-purple-100 text-purple-700 font-bold">
                            Start (-{GAME_COST} ⭐)
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-500 font-bold">
                            <Lock className="w-4 h-4 mr-2" /> Nog {GAME_COST - totalStars} ⭐
                            </span>
                        )}
                        </div>
                    </button>

                    {/* Locked Game 1 */}
                    <div className="flex-shrink-0 snap-center w-72 group relative bg-gray-50 rounded-3xl p-6 text-left border-4 border-transparent hover:border-gray-300 transition-all duration-300 flex flex-col h-80 cursor-not-allowed">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-3xl z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <span className="bg-black/80 text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                Binnenkort beschikbaar!
                            </span>
                        </div>
                        <div className="bg-gray-300 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-white shadow-md">
                        <Gamepad2 className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-heading text-gray-400 mb-2">Raad het Woord</h3>
                        <p className="text-gray-400 text-base mb-4 flex-grow">
                        Een leuk raadspelletje.
                        </p>
                        <div className="mt-auto">
                        <span className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-400 font-bold">
                            <Lock className="w-4 h-4 mr-2" /> Binnenkort
                        </span>
                        </div>
                    </div>

                    {/* Locked Game 2 */}
                    <div className="flex-shrink-0 snap-center w-72 group relative bg-gray-50 rounded-3xl p-6 text-left border-4 border-transparent hover:border-gray-300 transition-all duration-300 flex flex-col h-80 cursor-not-allowed">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-3xl z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <span className="bg-black/80 text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                Binnenkort beschikbaar!
                            </span>
                        </div>
                        <div className="bg-gray-300 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-white shadow-md">
                        <Gamepad2 className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-heading text-gray-400 mb-2">Puzzel Tijd</h3>
                        <p className="text-gray-400 text-base mb-4 flex-grow">
                        Maak de puzzel compleet.
                        </p>
                        <div className="mt-auto">
                        <span className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-400 font-bold">
                            <Lock className="w-4 h-4 mr-2" /> Binnenkort
                        </span>
                        </div>
                    </div>
                    
                    {/* Spacer for scrolling */}
                    <div className="w-4 flex-shrink-0"></div>
                </div>
            </div>
          </div>
        ) : (
          /* Memory Game Interface */
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <button 
                onClick={() => setActiveGame('menu')}
                className="text-purple-600 hover:text-purple-800 font-bold flex items-center gap-2 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                Terug
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm font-bold text-gray-700 transition-colors"
                >
                  <img 
                    src={`https://flagcdn.com/w40/${LANGUAGE_LABELS[gameLang]?.flagCode}.png`} 
                    alt="Flag" 
                    className="w-5 h-3.5 object-cover rounded-sm shadow-sm"
                  />
                  {LANGUAGE_LABELS[gameLang]?.label}
                </button>

                {showLangMenu && (
                  <div className="absolute top-10 right-0 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 p-2 z-50 w-48 animate-fade-in max-h-64 overflow-y-auto custom-scrollbar">
                    {Object.entries(LANGUAGE_LABELS).map(([code, { label, flagCode }]) => (
                      <button 
                        key={code}
                        onClick={() => {
                          handleLangChange(code as TargetLanguage);
                          setShowLangMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 ${gameLang === code ? 'bg-purple-50 text-purple-700 font-bold' : 'hover:bg-gray-50'}`}
                      >
                        <img 
                          src={`https://flagcdn.com/w40/${flagCode}.png`} 
                          alt={label} 
                          className="w-6 h-4 object-cover rounded-sm shadow-sm" 
                        />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="text-center mb-2">
              <h2 className="text-xl sm:text-2xl font-heading text-purple-600">Woord Memory</h2>
              <p className="text-gray-400 text-xs sm:text-sm">Zoek het Nederlandse woord bij de vertaling!</p>
            </div>

            {gameWon ? (
              <div className="text-center py-8 sm:py-12 animate-bounce-in">
                <div className="text-5xl sm:text-6xl mb-4">🎉🏆🎉</div>
                <h3 className="text-3xl sm:text-4xl font-heading text-[#8DBF45] mb-4">Gewonnen!</h3>
                <div className="flex gap-4 justify-center">
                  <button 
                    onClick={handleRestartGame}
                    className="bg-purple-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-600 shadow-lg transition-transform hover:scale-105"
                  >
                    Opnieuw Spelen
                  </button>
                  <button 
                    onClick={() => setActiveGame('menu')}
                    className="bg-gray-100 text-gray-500 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Terug naar Menu
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:gap-3 pb-2 max-w-md mx-auto w-full">
                {cards.map((card, idx) => (
                  <button
                    key={card.id}
                    onClick={() => handleCardClick(idx)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-300 transform relative overflow-hidden ${
                      card.flipped || card.matched
                      ? 'bg-purple-100 rotate-y-180 scale-100 border-2 border-purple-300'
                      : 'bg-purple-500 hover:bg-purple-600 scale-95 shadow-md hover:shadow-lg'
                    }`}
                  >
                    {(card.flipped || card.matched) ? (
                      <>
                        <span className="text-xl sm:text-2xl mb-1 animate-fade-in">{card.emoji}</span>
                        <span className="text-[9px] sm:text-[10px] font-bold text-purple-800 break-all px-1 leading-tight animate-fade-in">
                          {card.text}
                        </span>
                        {card.lang !== 'nl' && (
                          <img 
                            src={`https://flagcdn.com/w40/${LANGUAGE_LABELS[card.lang as TargetLanguage]?.flagCode}.png`}
                            alt="flag"
                            className="absolute top-2 right-2 w-5 h-3.5 object-cover rounded-sm shadow-sm"
                          />
                        )}
                      </>
                    ) : (
                      <span className="text-white/20 text-xl font-heading">?</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameCenter;
