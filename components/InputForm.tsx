import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Loader2, X, Globe, Gauge, Wand2, History, RotateCcw } from 'lucide-react';
import { TargetLanguage, LANGUAGE_LABELS, AppMode, AviLevel } from '../types';
import { LanguageCarousel } from './ui/LanguageCarousel';

interface InputFormProps {
  mode: AppMode;
  onProcess: (text: string, file: File | null, lang: TargetLanguage, avi: AviLevel) => void;
  isLoading: boolean;
  accentColor?: string;
}

const InputForm: React.FC<InputFormProps> = ({ mode, onProcess, isLoading, accentColor = '#8DBF45' }) => {
  const [text, setText] = useState('');
  
  const [lastUsedText, setLastUsedText] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('nt2_last_text');
    }
    return null;
  });

  const [selectedLang, setSelectedLang] = useState<TargetLanguage>(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('nt2_last_lang');
        if (stored && Object.values(TargetLanguage).includes(stored as TargetLanguage)) {
            return stored as TargetLanguage;
        }
    }
    return TargetLanguage.ARABIC;
  });

  const [selectedAvi, setSelectedAvi] = useState<AviLevel>(AviLevel.M3);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLangSelect = (lang: TargetLanguage) => {
      setSelectedLang(lang);
      localStorage.setItem('nt2_last_lang', lang);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save text to history if present
    if (text.trim()) {
        localStorage.setItem('nt2_last_text', text.trim());
    }

    if (mode === AppMode.FLASH && !text && !file) {
        // Allow empty input for Flash cards if we just want generated words (handled by parent logic via avi level)
        // But let's check if the parent logic supports generation without input.
        // For now, allow it and let service handle generation if text is empty.
    } else if (!text && !file) {
        return;
    }
    onProcess(text, file, selectedLang, selectedAvi);
  };

  const handleRestoreText = () => {
      if (lastUsedText) {
          setText(lastUsedText);
      }
  };

  const isDyslexiaOrFlash = mode === AppMode.DYSLEXIA || mode === AppMode.FLASH;

  // Theme colors helpers
  const getThemeColors = () => {
    if (mode === AppMode.DYSLEXIA) return { border: 'border-orange-200', bg: 'bg-orange-50', hover: 'hover:border-orange-400', text: 'text-orange-600', icon: 'text-orange-500' };
    if (mode === AppMode.FLASH) return { border: 'border-green-200', bg: 'bg-green-50', hover: 'hover:border-[#8DBF45]', text: 'text-[#8DBF45]', icon: 'text-[#8DBF45]' };
    return { border: 'border-blue-200', bg: 'bg-blue-50', hover: 'hover:border-[#005B8C]', text: 'text-[#005B8C]', icon: 'text-[#005B8C]' };
  };

  const theme = getThemeColors();
  
  // Dynamic styles for accent color
  const accentTextStyle = { color: accentColor };
  const accentBgStyle = { backgroundColor: accentColor };
  const accentBorderStyle = { borderColor: accentColor };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100 animate-fade-in-up">
      <div className={`p-8 text-white relative overflow-hidden ${mode === AppMode.DYSLEXIA ? 'bg-orange-500' : mode === AppMode.FLASH ? 'bg-[#8DBF45]' : 'bg-[#005B8C]'}`}>
        <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white rounded-full opacity-20 blur-xl"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-32 h-32 bg-white rounded-full opacity-20 blur-lg"></div>

        <h2 className="text-4xl font-heading flex items-center gap-3 relative z-10 mb-2 tracking-wide">
          {mode === AppMode.NT2 && "Lezen in je thuistaal"}
          {mode === AppMode.DYSLEXIA && "Lezen op niveau"}
          {mode === AppMode.FLASH && "Woordflitsen"}
        </h2>
        <p className="text-white/90 text-lg font-body relative z-10 font-medium">
            {mode === AppMode.FLASH ? "Upload tekst of kies een niveau voor automatische woorden." : "Upload een foto, PDF of Word document."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8 font-body">
        
        {/* Language Selection - Only for NT2 */}
        {mode === AppMode.NT2 && (
          <div>
            <label className="block text-2xl font-heading text-[#005B8C] mb-5 flex items-center gap-3">
              <Globe className="w-7 h-7" style={accentTextStyle} />
              Kies je taal:
            </label>
            <LanguageCarousel selectedLang={selectedLang} onSelect={handleLangSelect} />
          </div>
        )}

        {/* AVI Selection - For Dyslexia & Flash */}
        {isDyslexiaOrFlash && (
           <div>
            <label className="block text-2xl font-heading text-[#005B8C] mb-5 flex items-center gap-3">
              <Gauge className="w-7 h-7" style={accentTextStyle} />
              Kies AVI Niveau
            </label>
            <div className="flex flex-wrap gap-3">
                {Object.values(AviLevel).map((level) => (
                    <button
                        key={level}
                        type="button"
                        onClick={() => setSelectedAvi(level)}
                        className={`px-4 py-2 rounded-xl font-bold border-2 transition-all ${
                            selectedAvi === level 
                            ? 'bg-[#005B8C] text-white border-[#005B8C] shadow-lg scale-105'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-[#8DBF45] hover:text-[#005B8C]'
                        }`}
                    >
                        {level}
                    </button>
                ))}
            </div>
            {mode === AppMode.DYSLEXIA && (
                <p className="text-sm text-gray-400 mt-2 italic">De tekst wordt automatisch herschreven naar dit niveau.</p>
            )}
           </div>
        )}

        {/* Text Input */}
        <div>
          <label className="block text-xl font-heading text-[#005B8C] mb-3">
            Tekst Invoer {mode === AppMode.FLASH && "(Optioneel)"}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-40 p-5 border-2 border-gray-100 rounded-3xl focus:ring-4 focus:ring-blue-100 focus:border-[#005B8C] transition-all resize-none text-gray-800 text-lg placeholder:text-gray-300 font-body shadow-sm"
            placeholder={mode === AppMode.FLASH ? "Typ woorden om te flitsen, of laat leeg om automatisch te genereren..." : "Typ of plak hier de tekst..."}
          />
          
          {/* HISTORY RESTORE CARD */}
          {lastUsedText && !text && (
              <div className="mt-4 animate-fade-in">
                  <button
                    type="button"
                    onClick={handleRestoreText}
                    className={`w-full group relative overflow-hidden bg-white border-2 ${theme.border} ${theme.hover} p-4 rounded-2xl flex items-center gap-4 transition-all shadow-sm hover:shadow-md text-left`}
                  >
                      {/* Background accent */}
                      <div className={`absolute inset-0 ${theme.bg} opacity-50 group-hover:opacity-100 transition-opacity z-0`}></div>
                      
                      {/* Icon */}
                      <div className="bg-white p-3 rounded-full shadow-sm border border-gray-100 z-10 group-hover:scale-110 transition-transform">
                          <History className={`w-6 h-6 ${theme.icon}`} />
                      </div>
                      
                      {/* Text */}
                      <div className="flex-1 z-10 min-w-0">
                          <span className={`block ${theme.text} font-heading font-bold text-lg mb-0.5`}>
                              Ga verder met vorige tekst
                          </span>
                          <span className="block text-gray-600 text-sm truncate italic opacity-80 font-medium">
                              "{lastUsedText.substring(0, 50)}{lastUsedText.length > 50 ? '...' : ''}"
                          </span>
                      </div>
                      
                      {/* Action Arrow */}
                      <div className={`hidden sm:flex ${theme.text} bg-white px-3 py-1.5 rounded-lg text-sm font-bold items-center gap-2 shadow-sm z-10 opacity-70 group-hover:opacity-100 transition-all`}>
                          Herstel
                          <RotateCcw className="w-4 h-4" />
                      </div>
                  </button>
              </div>
          )}
        </div>

        {/* File Input */}
        <div>
          <label className="block text-xl font-heading text-[#005B8C] mb-3">
            Of kies een bestand
          </label>
          <div 
            className={`border-4 border-dashed rounded-[2rem] p-8 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer group ${
              file ? 'bg-green-50' : 'border-gray-200 hover:bg-green-50'
            }`}
            style={file ? { borderColor: accentColor } : {}}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            />
            
            {file ? (
              <div className="flex items-center gap-4 text-[#005B8C] w-full max-w-md bg-white p-4 rounded-2xl shadow-sm border" style={{ borderColor: `${accentColor}4D` }}>
                <div className="bg-green-50 p-3 rounded-full flex-shrink-0">
                  <FileText className="w-8 h-8" style={accentTextStyle} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-bold text-lg truncate font-heading">{file.name}</p>
                  <p className="text-sm opacity-70">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  className="p-2 hover:bg-red-100 hover:text-red-500 rounded-full transition-colors flex-shrink-0"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 p-5 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300 group-hover:bg-[#005B8C] group-hover:text-white text-[#005B8C]">
                  <Upload className="w-10 h-10" />
                </div>
                <p className="text-lg font-bold text-gray-400 group-hover:text-[#005B8C] transition-colors font-heading">
                  Foto, PDF of Word document
                </p>
              </>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || (mode !== AppMode.FLASH && !text && !file)}
          className={`w-full py-5 rounded-2xl font-heading text-2xl tracking-wide flex items-center justify-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl ${
            isLoading || (mode !== AppMode.FLASH && !text && !file)
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-200'
              : 'text-white transform hover:-translate-y-1 hover:scale-[1.01]'
          }`}
          style={!(isLoading || (mode !== AppMode.FLASH && !text && !file)) ? accentBgStyle : {}}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin" />
              Even geduld...
            </>
          ) : (
            mode === AppMode.FLASH && !text && !file ? (
                <>
                <Wand2 className="w-6 h-6" />
                Genereer Woorden & Start
                </>
            ) : 'Start de Oefening'
          )}
        </button>
      </form>
    </div>
  );
};

export default InputForm;