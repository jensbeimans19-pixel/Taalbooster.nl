import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Image as ImageIcon, Loader2, HelpCircle, Globe } from 'lucide-react';
import { getWordDefinition, generateIllustration } from '../services/geminiService';
import { TargetLanguage, LANGUAGE_LABELS } from '../types';

const FloatingChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>('nl');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [lastWord, setLastWord] = useState<string | null>(null);

  const [messages, setMessages] = useState<{ type: 'user' | 'bot'; text?: string; image?: string }[]>([
    { type: 'bot', text: 'Hoi! Typ een moeilijk woord, dan leg ik het uit met een plaatje.' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleLanguageChange = async (lang: string) => {
    setSelectedLang(lang);
    setShowLangMenu(false);

    if (lastWord) {
      setLoading(true);
      try {
        const newDef = await getWordDefinition(lastWord, "Context switch", lang);
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsgIndex = newMsgs.length - 1;
          if (newMsgs[lastMsgIndex].type === 'bot') {
            newMsgs[lastMsgIndex] = {
              ...newMsgs[lastMsgIndex],
              text: newDef
            };
          }
          return newMsgs;
        });
      } catch (e) {
        console.error("Translation failed", e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const word = input.trim();
    setInput('');
    setLoading(true);
    setLastWord(word);

    // Add user message
    setMessages(prev => [...prev, { type: 'user', text: word }]);

    try {
      // Parallel fetch for definition and image
      const [definition, imageUrl] = await Promise.allSettled([
        getWordDefinition(word, "Algemene context", selectedLang),
        generateIllustration(word)
      ]);

      const defText = definition.status === 'fulfilled' ? definition.value : "Kon geen uitleg vinden.";
      const imgData = imageUrl.status === 'fulfilled' ? imageUrl.value : undefined;

      setMessages(prev => [
        ...prev,
        { type: 'bot', text: defText, image: imgData }
      ]);
    } catch (error) {
      setMessages(prev => [...prev, { type: 'bot', text: "Oeps, er ging iets mis. Probeer het nog eens." }]);
    } finally {
      setLoading(false);
    }
  };

  const getFlagUrl = (lang: string) => {
    if (lang === 'nl') return "https://flagcdn.com/w40/nl.png";
    const label = LANGUAGE_LABELS[lang as TargetLanguage];
    if (label?.customFlagUrl) return label.customFlagUrl;
    return `https://flagcdn.com/w40/${label?.flagCode || 'nl'}.png`;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border-2 border-blue-100 overflow-hidden flex flex-col animate-fade-in-up origin-bottom-right" style={{ maxHeight: '500px' }}>
          {/* Header */}
          <div className="bg-[#005B8C] p-4 flex justify-between items-center text-white relative">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              <h3 className="font-heading font-bold">Woordhulp</h3>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setShowLangMenu(!showLangMenu)}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                >
                    <img 
                        src={getFlagUrl(selectedLang)}
                        alt="Flag" 
                        className="w-5 h-3.5 object-cover rounded-sm"
                    />
                    {selectedLang === 'nl' ? 'NL' : LANGUAGE_LABELS[selectedLang as TargetLanguage]?.label}
                </button>

                <button 
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-white/20 p-1 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
            </div>

            {/* Language Dropdown */}
            {showLangMenu && (
                <div className="absolute top-14 right-4 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 p-2 z-50 w-48 animate-fade-in max-h-64 overflow-y-auto custom-scrollbar">
                    <button 
                        onClick={() => handleLanguageChange('nl')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 ${selectedLang === 'nl' ? 'bg-blue-50 text-[#005B8C] font-bold' : 'hover:bg-gray-50'}`}
                    >
                        <img src="https://flagcdn.com/w40/nl.png" alt="NL" className="w-6 h-4 object-cover rounded-sm shadow-sm" />
                        Nederlands
                    </button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    {Object.values(TargetLanguage).map((lang) => (
                        <button 
                            key={lang}
                            onClick={() => handleLanguageChange(lang)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 ${selectedLang === lang ? 'bg-blue-50 text-[#005B8C] font-bold' : 'hover:bg-gray-50'}`}
                        >
                            <img 
                                src={getFlagUrl(lang)}
                                alt={LANGUAGE_LABELS[lang].label} 
                                className="w-6 h-4 object-cover rounded-sm shadow-sm" 
                            />
                            {LANGUAGE_LABELS[lang].label}
                        </button>
                    ))}
                </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4 min-h-[300px]">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[85%] rounded-2xl p-3 ${
                    msg.type === 'user' 
                      ? 'bg-[#005B8C] text-white rounded-br-none' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                  {msg.image && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-100">
                      <img src={msg.image} alt="Uitleg" className="w-full h-auto object-cover" />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none p-3 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#005B8C]" />
                  <span className="text-xs text-gray-500">Aan het denken...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Typ een woord..."
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#005B8C] focus:border-transparent text-sm"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || loading}
              className="bg-[#8DBF45] hover:bg-[#7cae35] disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors shadow-sm"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center ${
          isOpen ? 'bg-red-500 rotate-90' : 'bg-[#005B8C] hover:bg-[#004a73]'
        }`}
      >
        {isOpen ? (
          <X className="w-8 h-8 text-white" />
        ) : (
          <MessageCircle className="w-8 h-8 text-white" />
        )}
      </button>
    </div>
  );
};

export default FloatingChat;
