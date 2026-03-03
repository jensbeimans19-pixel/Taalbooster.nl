"use client"

import React, { memo, useEffect, useLayoutEffect, useMemo, useState, useRef } from "react"
import {
  motion,
  useAnimation,
  useMotionValue,
  useTransform,
} from "framer-motion"
import { AppMode } from "../../types"
import { BookOpen, Eye, Zap, Brain, ArrowRight, Languages, Glasses, MessageCircle, Lock } from 'lucide-react';

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

interface ToolCard {
    mode: AppMode;
    title: string;
    description: string;
    icon: React.ElementType;
    bgIcon: React.ElementType;
    color: string;
    accentColor: string;
    borderColor: string;
    locked?: boolean;
}

const TOOLS: ToolCard[] = [
    {
        mode: AppMode.NT2,
        title: "Lezen in je thuistaal",
        description: "Oefen met vertaling en voorleesfunctie.",
        icon: BookOpen,
        bgIcon: Languages,
        color: "bg-[#005B8C]",
        accentColor: "text-[#005B8C]",
        borderColor: "hover:border-[#005B8C]"
    },
    {
        mode: AppMode.DYSLEXIA,
        title: "Lezen op niveau",
        description: "Lees makkelijker met Dyslexiefont en AVI.",
        icon: Eye,
        bgIcon: Glasses,
        color: "bg-orange-500",
        accentColor: "text-orange-500",
        borderColor: "hover:border-orange-500"
    },
    {
        mode: AppMode.FLASH,
        title: "Woordflitsen",
        description: "Train je leessnelheid met flitswoorden.",
        icon: Zap,
        bgIcon: Zap,
        color: "bg-[#8DBF45]",
        accentColor: "text-[#8DBF45]",
        borderColor: "hover:border-[#8DBF45]"
    },
    {
        mode: AppMode.TAALSTART,
        title: "TaalStart",
        description: "Leer stap voor stap lezen.",
        icon: Brain,
        bgIcon: Brain,
        color: "bg-indigo-600",
        accentColor: "text-indigo-600",
        borderColor: "hover:border-indigo-600"
    },
    {
        mode: AppMode.SPREEKLAB,
        title: "Spreeklab",
        description: "Oefen gesprekken voeren.",
        icon: MessageCircle,
        bgIcon: MessageCircle,
        color: "bg-pink-500",
        accentColor: "text-pink-500",
        borderColor: "hover:border-pink-500",
        locked: true
    }
];

const TOOLS_DOUBLED = [...TOOLS, ...TOOLS];

const Carousel = memo(
  ({
    handleClick,
    controls,
    cards,
    isCarouselActive,
  }: {
    handleClick: (mode: AppMode) => void
    controls: any
    cards: ToolCard[]
    isCarouselActive: boolean
  }) => {
    const isScreenSizeSm = useMediaQuery("(max-width: 640px)")
    const cylinderWidth = isScreenSizeSm ? 1100 : 1800
    const faceCount = cards.length
    const faceWidth = cylinderWidth / faceCount
    const radius = cylinderWidth / (2 * Math.PI)
    
    const rotation = useMotionValue(0)
    const transform = useTransform(
      rotation,
      (value) => `rotate3d(0, 1, 0, ${value}deg)`
    )

    // Ensure controls are only started after mount
    const isMounted = useRef(false);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    return (
      <div
        className="flex h-full items-center justify-center overflow-visible"
        style={{
          perspective: "2000px",
          transformStyle: "preserve-3d",
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
          onDragEnd={(_, info) => {
            if (isCarouselActive && isMounted.current) {
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
          }}
          animate={controls}
        >
          {cards.map((card, i) => {
             return (
              <motion.div
                key={`key-${card.mode}-${i}`}
                className="absolute flex h-full origin-center items-center justify-center p-4"
                style={{
                  width: `${faceWidth}px`,
                  transform: `rotateY(${
                    i * (360 / faceCount)
                  }deg) translateZ(${radius}px)`,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
                onClick={() => !card.locked && handleClick(card.mode)}
              >
                <div
                  className={`w-40 sm:w-48 md:w-56 aspect-[4/5] bg-white rounded-[1.5rem] p-4 sm:p-5 text-left border-4 border-transparent ${card.locked ? 'border-gray-200 cursor-not-allowed' : `${card.borderColor} cursor-pointer hover:shadow-xl`} shadow-lg transition-all duration-300 flex flex-col group relative overflow-hidden antialiased`}
                  style={{
                    transform: 'translateZ(0)', // Improved sharpness fix
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                >
                  {card.locked && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                        <span className="bg-black/80 text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg transform -rotate-3">
                            Binnenkort!
                        </span>
                    </div>
                  )}

                  <div className="absolute top-3 right-3 opacity-10 group-hover:opacity-20 transition-opacity z-0 transform rotate-12">
                     <card.bgIcon className={`w-20 h-20 ${card.locked ? 'text-gray-400' : card.accentColor}`} />
                  </div>
                  
                  <div className={`${card.locked ? 'bg-gray-400' : card.color} w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 text-white shadow-md relative z-10`}>
                    <card.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  
                  <h3 className={`text-base sm:text-lg md:text-xl font-heading ${card.locked ? 'text-gray-400' : card.accentColor} mb-1 relative z-10 leading-tight`}>{card.title}</h3>
                  <p className="text-gray-500 font-body mb-3 flex-grow relative z-10 text-xs sm:text-sm leading-relaxed line-clamp-4">
                    {card.description}
                  </p>
                  
                  <div className={`flex items-center ${card.locked ? 'text-gray-400' : card.accentColor} font-bold text-sm sm:text-base group-hover:gap-1.5 transition-all relative z-10 mt-auto`}>
                    {card.locked ? (
                        <>
                            <Lock className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" /> Binnenkort
                        </>
                    ) : (
                        <>
                            Starten <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1" />
                        </>
                    )}
                  </div>
                </div>
            </motion.div>
          )})}
        </motion.div>
      </div>
    )
  }
)

export function ToolCarousel({ 
    onSelect 
}: { 
    onSelect: (mode: AppMode) => void 
}) {
  const [isCarouselActive, setIsCarouselActive] = useState(true)
  const controls = useAnimation()
  
  const handleClick = (mode: AppMode) => {
    onSelect(mode);
  }

  return (
    <div className="relative h-[320px] w-full py-2">
        <Carousel
          handleClick={handleClick}
          controls={controls}
          cards={TOOLS_DOUBLED}
          isCarouselActive={isCarouselActive}
        />
        
        {/* Helper text */}
        <div className="absolute bottom-4 left-0 right-0 text-center text-gray-400 text-sm pointer-events-none">
            Sleep om te draaien • Klik om te kiezen
        </div>
    </div>
  )
}
