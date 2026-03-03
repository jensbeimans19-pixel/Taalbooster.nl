
export interface SentencePair {
  nl: string;
  tr: string;
}

export enum TargetLanguage {
  ARABIC = 'ar',
  TURKISH = 'tr',
  UKRAINIAN = 'uk',
  ENGLISH = 'en',
  SPANISH = 'es',
  FRENCH = 'fr',
  POLISH = 'pl',
  SOMALI = 'so',
  GERMAN = 'de',
  CHINESE = 'zh',
  PERSIAN = 'fa',
  PASHTO = 'ps',
  KURMANJI = 'ku'
}

export enum AppMode {
  HOME = 'home',
  NT2 = 'nt2',
  DYSLEXIA = 'dyslexia',
  FLASH = 'flash',
  TAALSTART = 'taalstart',
  SPREEKLAB = 'spreeklab'
}

export enum AviLevel {
  START = 'Start',
  M3 = 'M3',
  E3 = 'E3',
  M4 = 'M4',
  E4 = 'E4',
  M5 = 'M5',
  E5 = 'E5',
  M6 = 'M6',
  E6 = 'E6',
  M7 = 'M7',
  E7 = 'E7',
  PLUS = 'Plus'
}

export interface ProcessingResult {
  sentences: SentencePair[];
  sourceText: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export const LANGUAGE_LABELS: Record<TargetLanguage, { label: string; flag: string; flagCode: string; customFlagUrl?: string }> = {
  // European Cluster
  [TargetLanguage.ENGLISH]: { label: 'Engels', flag: '🇬🇧', flagCode: 'gb' },
  [TargetLanguage.GERMAN]: { label: 'Duits', flag: '🇩🇪', flagCode: 'de' },
  [TargetLanguage.FRENCH]: { label: 'Frans', flag: '🇫🇷', flagCode: 'fr' },
  [TargetLanguage.SPANISH]: { label: 'Spaans', flag: '🇪🇸', flagCode: 'es' },
  [TargetLanguage.POLISH]: { label: 'Pools', flag: '🇵🇱', flagCode: 'pl' },
  [TargetLanguage.UKRAINIAN]: { label: 'Oekraïens', flag: '🇺🇦', flagCode: 'ua' },
  
  // Middle Eastern / Asian / African Cluster
  [TargetLanguage.TURKISH]: { label: 'Turks', flag: '🇹🇷', flagCode: 'tr' },
  [TargetLanguage.ARABIC]: { label: 'Arabisch', flag: '🇸🇦', flagCode: 'sa' },
  [TargetLanguage.PERSIAN]: { label: 'Perzisch', flag: '🇮🇷', flagCode: 'ir' },
  [TargetLanguage.KURMANJI]: { label: 'Koerdisch (Kurmanji)', flag: '☀️', flagCode: 'ku', customFlagUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Flag_of_Kurdistan.svg/800px-Flag_of_Kurdistan.svg.png' },
  [TargetLanguage.PASHTO]: { label: 'Pashto', flag: '🇦🇫', flagCode: 'af', customFlagUrl: 'https://i.ytimg.com/vi/aGAVy-hOzig/maxresdefault.jpg' },
  [TargetLanguage.SOMALI]: { label: 'Somalisch', flag: '🇸🇴', flagCode: 'so' },
  [TargetLanguage.CHINESE]: { label: 'Chinees', flag: '🇨🇳', flagCode: 'cn' },
};

export const WEB_SPEECH_LANGS: Record<TargetLanguage | 'nl', string> = {
  [TargetLanguage.ARABIC]: 'ar-SA',
  [TargetLanguage.TURKISH]: 'tr-TR',
  [TargetLanguage.UKRAINIAN]: 'uk-UA',
  [TargetLanguage.ENGLISH]: 'en-US',
  [TargetLanguage.SPANISH]: 'es-ES',
  [TargetLanguage.FRENCH]: 'fr-FR',
  [TargetLanguage.POLISH]: 'pl-PL',
  [TargetLanguage.SOMALI]: 'so-SO', // Note: Browser support for Somali TTS might be limited
  [TargetLanguage.GERMAN]: 'de-DE',
  [TargetLanguage.CHINESE]: 'zh-CN',
  [TargetLanguage.PERSIAN]: 'fa-IR',
  [TargetLanguage.PASHTO]: 'ps-AF', // Limited support likely
  [TargetLanguage.KURMANJI]: 'ku-TR', // or kmr-TR, browser support varies
  'nl': 'nl-NL'
};

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: { score: number; streak: number }) => boolean;
}

export const BADGES: Badge[] = [
  {
    id: 'beginner',
    name: 'Starter',
    description: 'Verdien je eerste 10 sterren',
    icon: '🌟',
    condition: (stats) => stats.score >= 10
  },
  {
    id: 'streak_3',
    name: 'Volhouder',
    description: 'Oefen 3 dagen op rij',
    icon: '🔥',
    condition: (stats) => stats.streak >= 3
  },
  {
    id: 'score_100',
    name: 'Sterrenvanger',
    description: 'Verdien 100 sterren',
    icon: '✨',
    condition: (stats) => stats.score >= 100
  },
  {
    id: 'streak_7',
    name: 'Weekkampioen',
    description: 'Oefen 7 dagen op rij',
    icon: '🏆',
    condition: (stats) => stats.streak >= 7
  },
  {
    id: 'score_500',
    name: 'Superster',
    description: 'Verdien 500 sterren',
    icon: '🚀',
    condition: (stats) => stats.score >= 500
  },
  {
    id: 'score_1000',
    name: 'Legende',
    description: 'Verdien 1000 sterren',
    icon: '👑',
    condition: (stats) => stats.score >= 1000
  }
];

export enum TaalStartLevel {
  LEVEL_1 = 'klank-woord',
  LEVEL_2 = 'korte-zinnen',
  LEVEL_3 = 'samengestelde-zinnen',
  LEVEL_4 = 'mini-verhalen',
  LEVEL_5 = 'langere-teksten'
}

export interface TaalStartLesson {
  id: string;
  level: TaalStartLevel;
  phase1: {
    audioText: string;
    imageUrl?: string; // Emoji or description for image generation
    visualSupport: string;
  };
  phase2: {
    text: string;
    difficultWords: { word: string; meaning: string }[];
  };
  phase3: {
    questions: {
      question: string;
      options: string[];
      correctAnswer: number;
    }[];
    wordMatching: { word: string; meaning: string }[];
  };
  phase4: {
    sentenceCompletion: { sentence: string; missingWord: string; options: string[] }[];
    speakingPrompt: string;
  };
}

export interface TaalStartProgress {
  currentLevel: TaalStartLevel;
  listeningScore: number;
  vocabularyScore: number;
  speakingScore: number;
  practiceTime: number; // in minutes
  errorFrequency: Record<string, number>; // category -> count
  completedLessons: number;
}
