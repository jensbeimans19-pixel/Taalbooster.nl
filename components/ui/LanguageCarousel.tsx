"use client"

import { memo, useEffect, useLayoutEffect, useMemo, useState, useRef } from "react"
import {
  AnimatePresence,
  motion,
  useAnimation,
  useMotionValue,
  useTransform,
} from "framer-motion"
import { TargetLanguage, LANGUAGE_LABELS } from "../../types"

export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

type UseMediaQueryOptions = {
  defaultValue?: boolean
  initializeWithValue?: boolean
}

const IS_SERVER = typeof window === "undefined"

export function useMediaQuery(
  query: string,
  {
    defaultValue = false,
    initializeWithValue = true,
  }: UseMediaQueryOptions = {}
): boolean {
  const getMatches = (query: string): boolean => {
    if (IS_SERVER) {
      return defaultValue
    }
    return window.matchMedia(query).matches
  }

  const [matches, setMatches] = useState<boolean>(() => {
    if (initializeWithValue) {
      return getMatches(query)
    }
    return defaultValue
  })

  const handleChange = () => {
    setMatches(getMatches(query))
  }

  useIsomorphicLayoutEffect(() => {
    const matchMedia = window.matchMedia(query)
    handleChange()

    matchMedia.addEventListener("change", handleChange)

    return () => {
      matchMedia.removeEventListener("change", handleChange)
    }
  }, [query])

  return matches
}

const duration = 0.5
const transition = { duration, ease: [0.32, 0.72, 0, 1] }

const FLAG_CODES: Record<TargetLanguage, string> = {
  [TargetLanguage.ARABIC]: 'sa',
  [TargetLanguage.TURKISH]: 'tr',
  [TargetLanguage.UKRAINIAN]: 'ua',
  [TargetLanguage.ENGLISH]: 'gb',
  [TargetLanguage.SPANISH]: 'es',
  [TargetLanguage.FRENCH]: 'fr',
  [TargetLanguage.POLISH]: 'pl',
  [TargetLanguage.SOMALI]: 'so',
  [TargetLanguage.GERMAN]: 'de',
  [TargetLanguage.CHINESE]: 'cn',
  [TargetLanguage.PERSIAN]: 'ir',
  [TargetLanguage.PASHTO]: 'af',
  [TargetLanguage.KURMANJI]: 'iq', // Placeholder, uses customFlagUrl
};

interface LanguageCard {
    code: TargetLanguage;
    label: string;
    flag: string;
    customFlagUrl?: string;
}

const Carousel = memo(
  ({
    handleClick,
    controls,
    cards,
    isCarouselActive,
    selectedLang
  }: {
    handleClick: (code: TargetLanguage) => void
    controls: any
    cards: LanguageCard[]
    isCarouselActive: boolean
    selectedLang: TargetLanguage
  }) => {
    const isScreenSizeSm = useMediaQuery("(max-width: 640px)")
    const cylinderWidth = isScreenSizeSm ? 900 : 1500
    const faceCount = cards.length
    const faceWidth = cylinderWidth / faceCount
    const radius = cylinderWidth / (2 * Math.PI)
    
    // Calculate initial rotation to center the selected language
    // We only want to set this ONCE on mount or when the cards change, not on every selection change
    // because selection change happens on click, and we don't want to snap-rotate if the user is dragging.
    // However, if the selection comes from local storage (external), we might want to update.
    // But for now, let's just rely on the initial value for the "start at front" requirement.
    
    const initialIndex = useMemo(() => cards.findIndex(c => c.code === selectedLang), []); 
    const initialRotation = initialIndex !== -1 ? -initialIndex * (360 / faceCount) : 0;
    
    const rotation = useMotionValue(initialRotation)
    const transform = useTransform(
      rotation,
      (value) => `rotate3d(0, 1, 0, ${value}deg)`
    )

    // Sync rotation when selectedLang changes
    const isMounted = useRef(false);
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }

        const index = cards.findIndex(c => c.code === selectedLang);
        if (index !== -1) {
            const targetRotation = -index * (360 / faceCount);
            
            // Animate to the new rotation
            controls.start({
                rotateY: targetRotation,
                transition: { 
                    type: "spring",
                    stiffness: 50,
                    damping: 20,
                    mass: 1
                }
            });
            
            // Keep the motion value in sync for drag interactions
            rotation.set(targetRotation);
        }
    }, [selectedLang, cards, faceCount, controls, rotation]);

    return (
      <div
        className="flex h-full items-center justify-center"
        style={{
          perspective: "1000px",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <motion.div
          drag={isCarouselActive ? "x" : false}
          className="relative flex h-full origin-center cursor-grab justify-center active:cursor-grabbing"
          style={{
            transform,
            rotateY: rotation,
            width: cylinderWidth,
            transformStyle: "preserve-3d",
          }}
          onDrag={(_, info) =>
            isCarouselActive &&
            rotation.set(rotation.get() + info.delta.x * 0.2)
          }
          onDragEnd={(_, info) =>
            isCarouselActive &&
            controls.start({
              rotateY: rotation.get() + info.velocity.x * 0.1,
              transition: {
                type: "spring",
                stiffness: 50,
                damping: 20,
                mass: 1,
              },
            })
          }
          animate={controls}
        >
          {cards.map((card, i) => {
             const isSelected = selectedLang === card.code;
             
             return (
              <motion.div
                key={`key-${card.code}-${i}`}
                className="absolute flex h-full origin-center items-center justify-center p-2"
                style={{
                  width: `${faceWidth}px`,
                  transform: `rotateY(${
                    i * (360 / faceCount)
                  }deg) translateZ(${radius}px)`,
                  willChange: "transform",
                }}
                onClick={() => handleClick(card.code)}
              >
                 <div
                  className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 shadow-md border-2 transition-all duration-300 cursor-pointer backface-hidden
                    ${isSelected
                      ? 'bg-blue-50 border-[#005B8C] scale-105 ring-2 ring-blue-100 z-10' 
                      : 'bg-white border-gray-100 hover:border-[#8DBF45] hover:bg-green-50 opacity-90 hover:opacity-100'
                    }`}
                >
                 {card.customFlagUrl ? (
                    <img 
                        src={card.customFlagUrl}
                        alt={card.label}
                        draggable={false}
                        className="w-16 h-16 object-cover drop-shadow-sm rounded-md select-none pointer-events-none"
                    />
                 ) : (
                    <img 
                        src={`https://flagcdn.com/w160/${FLAG_CODES[card.code]}.png`}
                        alt={card.label}
                        draggable={false}
                        className="w-16 h-16 object-contain drop-shadow-sm rounded-md select-none pointer-events-none"
                    />
                 )}
                 <span className={`font-bold text-sm font-heading tracking-wide text-center select-none ${
                    isSelected ? 'text-[#005B8C]' : 'text-gray-500'
                  }`}>
                    {card.label}
                 </span>
                 {isSelected && (
                    <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#8DBF45] shadow-sm animate-pulse" />
                 )}
              </div>
            </motion.div>
          )})}
        </motion.div>
      </div>
    )
  }
)

export function LanguageCarousel({ 
    selectedLang, 
    onSelect 
}: { 
    selectedLang: TargetLanguage; 
    onSelect: (lang: TargetLanguage) => void 
}) {
  const [isCarouselActive, setIsCarouselActive] = useState(true)
  const controls = useAnimation()
  
  const cards = useMemo(() => {
    return (Object.entries(LANGUAGE_LABELS) as [TargetLanguage, { label: string; flag: string; customFlagUrl?: string }][])
        .map(([code, { label, flag, customFlagUrl }]) => ({ code, label, flag, customFlagUrl }));
  }, []);

  const handleClick = (code: TargetLanguage) => {
    onSelect(code);
  }

  return (
    <div className="relative h-[220px] w-full overflow-hidden py-2">
        <Carousel
          handleClick={handleClick}
          controls={controls}
          cards={cards}
          isCarouselActive={isCarouselActive}
          selectedLang={selectedLang}
        />
        
        {/* Helper text */}
        <div className="absolute bottom-1 left-0 right-0 text-center text-gray-400 text-xs pointer-events-none">
            Sleep om te draaien • Klik om te kiezen
        </div>
    </div>
  )
}
