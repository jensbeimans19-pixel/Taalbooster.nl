import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Sparkles, GraduationCap, Users, X, Lock, Mail, Send, Eye, EyeOff } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);

  const handleSchoolClick = (schoolId: string) => {
      if (schoolId === 'demo') {
          // Always require code for demo
          setSelectedSchool(schoolId);
          setAccessCode('');
          setError('');
          return;
      }

      // Check if already unlocked
      const isUnlocked = localStorage.getItem(`school_access_${schoolId}`);
      if (isUnlocked === 'true') {
          navigate(`/${schoolId}`);
      } else {
          setSelectedSchool(schoolId);
          setAccessCode('');
          setError('');
      }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedSchool === 'eenbes' && accessCode === '5664HB') {
          localStorage.setItem(`school_access_eenbes`, 'true');
          navigate('/eenbes');
      } else if (selectedSchool === 'demo' && accessCode === '6021DW') {
          sessionStorage.setItem('demo_school_access', 'true');
          navigate('/demo');
      } else {
          setError('Ongeldige toegangscode');
      }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 relative">
      
      {/* Demo Request Modal */}
      {showDemoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowDemoModal(false)}>
              <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl border-4 border-[#005B8C] animate-bounce-in relative" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => setShowDemoModal(false)}
                    className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500"
                  >
                      <X className="w-6 h-6" />
                  </button>
                  
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Mail className="w-8 h-8 text-[#005B8C]" />
                      </div>
                      <h3 className="text-2xl font-heading text-[#005B8C] mb-2">Vraag een Demo Aan</h3>
                      <p className="text-gray-500 text-sm">Vul je gegevens in en we nemen contact op voor een vrijblijvende demonstratie.</p>
                  </div>

                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Bedankt voor je aanvraag! We nemen spoedig contact op.'); setShowDemoModal(false); }}>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Naam School / Organisatie</label>
                          <input type="text" required className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#005B8C] focus:outline-none" placeholder="Bijv. Basisschool De Klimop" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Contactpersoon</label>
                          <input type="text" required className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#005B8C] focus:outline-none" placeholder="Jouw naam" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">E-mailadres</label>
                          <input type="email" required className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#005B8C] focus:outline-none" placeholder="naam@school.nl" />
                      </div>
                      <button type="submit" className="w-full bg-[#005B8C] text-white py-3 rounded-xl font-bold hover:bg-[#004a73] transition-colors shadow-md flex items-center justify-center gap-2">
                          <Send className="w-5 h-5" />
                          Verstuur Aanvraag
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* School Selection Modal */}
      {showSchoolModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowSchoolModal(false)}>
              <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl border-4 border-[#005B8C] animate-bounce-in relative" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => setShowSchoolModal(false)}
                    className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500"
                  >
                      <X className="w-6 h-6" />
                  </button>

                  {!selectedSchool ? (
                      <>
                        <h3 className="text-2xl font-heading text-[#005B8C] mb-6 text-center">Kies je school of organisatie</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <button 
                                onClick={() => handleSchoolClick('eenbes')}
                                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-[#F58220] hover:bg-orange-50 transition-all group text-left"
                            >
                                <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center p-2">
                                    <img 
                                        src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhy4ztCdk76HOQFJSYJp1jXYkvDlAuAcKA_rsF_YTRNX30_KaYzgOkKCXZiAjr5EjcxmB84BCY1K5lKCRXzJeiqkPsfiozG66TpJA7mY7-yqPVNGvatrh6GPZjzfe5h24D-KnVrqhjkLlM7gEb3A7I2Ga5Jn4VWTWtAtMz22kvhXZUbAjsVQirlRBgUGEs/s340/logo_99502944.png" 
                                        alt="Eenbes" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 group-hover:text-[#005B8C]">Eenbes Basisonderwijs</h4>
                                    <p className="text-sm text-gray-500">Toegang voor medewerkers & leerlingen</p>
                                </div>
                            </button>

                            <button 
                                onClick={() => handleSchoolClick('demo')}
                                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-[#F58220] hover:bg-orange-50 transition-all group text-left"
                            >
                                <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center p-2">
                                    <img 
                                        src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjAYOs64Yxc4eMYZpEZxSW_lAiOGlRGfGF6hi7pjuP2isr9X5676J5EuE9rqVuEDUy9FGRP-IMNHfYTKx1qM5Bo2zDz9OqzCKqbr8bC4FGMUKPoHLnss6IusvqbHcu-W7FZyxlz69VQUBGfnAbcQK61r3M9xbw_sk5L67Y2Z_aRNLuiVzvltoBj5cfNeG0/s800/Taalbooster%20txt%20logo%20(1).png" 
                                        alt="TaalBooster Demo" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 group-hover:text-[#005B8C]">TaalBooster Demo School</h4>
                                    <p className="text-sm text-gray-500">Omgeving voor demonstraties</p>
                                </div>
                            </button>
                            {/* Placeholder for other schools */}
                            <div className="p-4 rounded-2xl border-2 border-dashed border-gray-200 text-center text-gray-400 text-sm">
                                Meer scholen volgen binnenkort...
                            </div>
                        </div>
                      </>
                  ) : (
                      <div className="text-center">
                          <div className="w-20 h-20 bg-white rounded-2xl shadow-md border border-gray-100 mx-auto mb-4 flex items-center justify-center p-3">
                                <img 
                                    src={selectedSchool === 'eenbes' 
                                        ? "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhy4ztCdk76HOQFJSYJp1jXYkvDlAuAcKA_rsF_YTRNX30_KaYzgOkKCXZiAjr5EjcxmB84BCY1K5lKCRXzJeiqkPsfiozG66TpJA7mY7-yqPVNGvatrh6GPZjzfe5h24D-KnVrqhjkLlM7gEb3A7I2Ga5Jn4VWTWtAtMz22kvhXZUbAjsVQirlRBgUGEs/s340/logo_99502944.png"
                                        : "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjAYOs64Yxc4eMYZpEZxSW_lAiOGlRGfGF6hi7pjuP2isr9X5676J5EuE9rqVuEDUy9FGRP-IMNHfYTKx1qM5Bo2zDz9OqzCKqbr8bC4FGMUKPoHLnss6IusvqbHcu-W7FZyxlz69VQUBGfnAbcQK61r3M9xbw_sk5L67Y2Z_aRNLuiVzvltoBj5cfNeG0/s800/Taalbooster%20txt%20logo%20(1).png"
                                    } 
                                    alt="School Logo" 
                                    className="w-full h-full object-contain"
                                />
                          </div>
                          <h3 className="text-xl font-heading text-[#005B8C] mb-2">Toegangscode Vereist</h3>
                          <p className="text-gray-500 mb-6 text-sm">
                              {selectedSchool === 'demo' 
                                ? "Voer de demo code in om te starten." 
                                : "Voer de toegangscode in voor dit apparaat. Dit hoeft maar één keer."}
                          </p>
                          
                          <form onSubmit={handleCodeSubmit} className="max-w-xs mx-auto">
                              <div className="relative mb-4">
                                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                  <input 
                                    type={showPassword ? "text" : "password"}
                                    value={accessCode}
                                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                    placeholder="Code"
                                    className="w-full pl-10 pr-12 py-3 rounded-xl border-2 border-gray-200 focus:border-[#F58220] focus:outline-none font-mono text-center text-lg uppercase tracking-widest"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                  >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                  </button>
                              </div>
                              {error && <p className="text-red-500 text-sm font-bold mb-4 animate-pulse">{error}</p>}
                              
                              <div className="flex gap-3">
                                  <button 
                                    type="button"
                                    onClick={() => setSelectedSchool(null)}
                                    className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                                  >
                                      Terug
                                  </button>
                                  <button 
                                    type="submit"
                                    className="flex-1 bg-[#F58220] text-white py-3 rounded-xl font-bold hover:bg-[#d9731c] transition-colors shadow-md"
                                  >
                                      Verifiëren
                                  </button>
                              </div>
                          </form>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <img 
              src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjAYOs64Yxc4eMYZpEZxSW_lAiOGlRGfGF6hi7pjuP2isr9X5676J5EuE9rqVuEDUy9FGRP-IMNHfYTKx1qM5Bo2zDz9OqzCKqbr8bC4FGMUKPoHLnss6IusvqbHcu-W7FZyxlz69VQUBGfnAbcQK61r3M9xbw_sk5L67Y2Z_aRNLuiVzvltoBj5cfNeG0/s800/Taalbooster%20txt%20logo%20(1).png" 
              alt="TaalBooster" 
              className="h-8 sm:h-10 w-auto object-contain"
            />
        </div>
        <div className="flex gap-4">
            <button 
                onClick={() => setShowSchoolModal(true)}
                className="bg-[#005B8C] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#004a73] transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
            >
                <Users className="w-5 h-5" />
                Scholen & Organisaties
            </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Text Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-orange-50 text-[#F58220] px-4 py-2 rounded-full font-bold text-sm mb-6 border border-orange-100">
                <Sparkles className="w-4 h-4" />
                <span>Nu beschikbaar voor basisonderwijs</span>
              </div>
              
              <h1 className="text-5xl sm:text-6xl font-heading text-[#005B8C] leading-tight mb-6">
                Iedere leerling een <span className="text-[#F58220]">taalboost</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                TaalBooster helpt leerlingen met lezen, woordenschat en taalbegrip door slimme AI-ondersteuning. 
                Van NT2-leerlingen tot kinderen met dyslexie: iedereen leest mee op eigen niveau.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button 
                    onClick={() => setShowSchoolModal(true)}
                    className="bg-[#F58220] text-white px-8 py-4 rounded-2xl font-heading text-xl hover:bg-[#d9731c] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-3"
                >
                    Start Direct
                    <ArrowRight className="w-6 h-6" />
                </button>
                <button 
                    onClick={() => setShowDemoModal(true)}
                    className="bg-white text-[#005B8C] border-2 border-[#005B8C]/20 px-8 py-4 rounded-2xl font-heading text-xl hover:border-[#005B8C] hover:bg-blue-50 transition-all"
                >
                    Vraag Demo Aan
                </button>
              </div>
            </div>

            {/* Preview Image / Visual */}
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-green-100 rounded-[3rem] transform rotate-3 scale-105 -z-10 blur-xl opacity-60"></div>
                <div className="bg-white rounded-[2.5rem] shadow-2xl border-4 border-white overflow-hidden transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                    <img 
                        src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2022&auto=format&fit=crop" 
                        alt="Kinderen leren lezen" 
                        className="w-full h-auto object-cover opacity-90"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md p-6 border-t border-gray-100">
                        <div className="flex items-center gap-4">
                            <div className="bg-[#F58220] p-3 rounded-full text-white">
                                <BookOpen className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-heading text-[#005B8C] text-lg">Direct aan de slag</h3>
                                <p className="text-sm text-gray-500">Geen installatie nodig, werkt in de browser.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                  <h2 className="text-3xl font-heading text-[#005B8C] mb-4">Waarom TaalBooster?</h2>
                  <p className="text-gray-600 max-w-2xl mx-auto">Onze tools zijn ontwikkeld om leerkrachten te ontlasten en leerlingen te motiveren.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                  <FeatureCard 
                    icon={<GraduationCap className="w-8 h-8 text-white" />}
                    color="bg-blue-500"
                    title="Op Maat Gemaakt"
                    desc="Teksten worden automatisch aangepast naar het juiste AVI-niveau of vertaald naar de thuistaal."
                  />
                  <FeatureCard 
                    icon={<Sparkles className="w-8 h-8 text-white" />}
                    color="bg-orange-500"
                    title="Direct Feedback"
                    desc="Leerlingen krijgen direct hulp bij moeilijke woorden en kunnen oefenen met flitskaarten."
                  />
                  <FeatureCard 
                    icon={<Users className="w-8 h-8 text-white" />}
                    color="bg-green-500"
                    title="Voor Iedereen"
                    desc="Of het nu gaat om NT2, dyslexie of gewoon extra oefening: TaalBooster past zich aan."
                  />
              </div>
          </div>
      </section>

      {/* Info Modal */}
      {selectedInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedInfo(null)}>
              <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl border-4 border-[#005B8C] animate-bounce-in relative max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => setSelectedInfo(null)}
                    className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 sticky top-0 float-right z-10"
                  >
                      <X className="w-6 h-6" />
                  </button>
                  
                  <div className="mb-6">
                      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                          {selectedInfo === 'privacy' && <Lock className="w-8 h-8 text-[#005B8C]" />}
                          {selectedInfo === 'terms' && <BookOpen className="w-8 h-8 text-[#005B8C]" />}
                          {selectedInfo === 'quality' && <Sparkles className="w-8 h-8 text-[#005B8C]" />}
                      </div>
                      <h3 className="text-2xl font-heading text-[#005B8C] mb-2">
                          {selectedInfo === 'privacy' && "Privacy & Gegevens"}
                          {selectedInfo === 'terms' && "Algemene Voorwaarden"}
                          {selectedInfo === 'quality' && "Kwaliteit & Focus"}
                      </h3>
                  </div>

                  <div className="space-y-6 text-left">
                      {selectedInfo === 'privacy' && (
                          <>
                              <p className="text-gray-500 italic">Jouw privacy is belangrijk. Daarom verzamelen wij zo min mogelijk gegevens.</p>
                              <div>
                                  <h4 className="font-bold text-gray-800 mb-2">Geen leerlinggegevens</h4>
                                  <p className="text-gray-600 leading-relaxed">Wij verzamelen geen leerlinggegevens. Alles wordt in de eigen browseromgeving van de leerling toegepast. Er worden geen accounts aangemaakt op dit platform.</p>
                              </div>
                              <div>
                                  <h4 className="font-bold text-gray-800 mb-2">Lokale opslag</h4>
                                  <p className="text-gray-600 leading-relaxed">De enige data die lokaal wordt opgeslagen (cookies/local storage) is voor functionele doeleinden, zoals het onthouden van je favorieten en laatst bekeken items. Deze data verlaat jouw apparaat niet.</p>
                              </div>
                              <div>
                                  <h4 className="font-bold text-gray-800 mb-2">Verwerkersovereenkomst</h4>
                                  <p className="text-gray-600 leading-relaxed">Voor de verwerkersovereenkomst verwijzen we door naar de eigen schoolomgeving, aangezien al het werk daar plaatsvindt.</p>
                              </div>
                          </>
                      )}

                      {selectedInfo === 'terms' && (
                          <>
                              <p className="text-gray-500 italic">Duidelijke afspraken voor een goede samenwerking.</p>
                              <div>
                                  <h4 className="font-bold text-gray-800 mb-2">Dienstverlening</h4>
                                  <p className="text-gray-600 leading-relaxed">Het TaalBooster platform en onze diensten worden met de grootste zorg samengesteld. Wij streven ernaar om actuele en relevante tools voor taalonderwijs te bieden.</p>
                              </div>
                              <div>
                                  <h4 className="font-bold text-gray-800 mb-2">Gebruik materialen</h4>
                                  <p className="text-gray-600 leading-relaxed">Alle materialen op dit platform zijn bedoeld voor educatief gebruik. Het is toegestaan deze in de klas te gebruiken. Commercieel gebruik of doorverkoop is niet toegestaan zonder schriftelijke toestemming.</p>
                              </div>
                              <div>
                                  <h4 className="font-bold text-gray-800 mb-2">Vragen?</h4>
                                  <p className="text-gray-600 leading-relaxed">Neem gerust <button onClick={() => { setSelectedInfo(null); setShowDemoModal(true); }} className="text-[#005B8C] underline hover:text-[#004a73]">contact op</button> als je specifieke vragen hebt over het gebruik van onze materialen.</p>
                              </div>
                          </>
                      )}

                      {selectedInfo === 'quality' && (
                          <>
                              <p className="text-gray-500 italic">Wij gaan voor de hoogste kwaliteit in onderwijs.</p>
                              <div>
                                  <h4 className="font-bold text-gray-800 mb-2">Onze Standaard</h4>
                                  <p className="text-gray-600 leading-relaxed">Wij evalueren onze workshops en materialen continu. Feedback van deelnemers en leerlingen is hierin leidend. We zorgen dat onze content aansluit bij de actuele kerndoelen en onderwijsbehoeften.</p>
                              </div>
                              <div>
                                  <h4 className="font-bold text-gray-800 mb-2">Certificering</h4>
                                  <p className="text-gray-600 leading-relaxed">TaalBooster werkt met erkende onderwijsexperts en volgt de laatste ontwikkelingen op de voet. Zo ben je altijd verzekerd van de nieuwste features en didactische toepassingen.</p>
                              </div>
                              <div>
                                  <h4 className="font-bold text-gray-800 mb-2">Feedback</h4>
                                  <p className="text-gray-600 leading-relaxed">Heb je tips ter verbetering? Wij horen het graag via het <button onClick={() => { setSelectedInfo(null); setShowDemoModal(true); }} className="text-[#005B8C] underline hover:text-[#004a73]">contactformulier</button>.</p>
                              </div>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12">
          <div className="max-w-7xl mx-auto px-4 text-center">
              <img 
                src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEimYmYyxgO7pa79kgzvNzWJZY2dpI3nRRe8w0r8M76myK4G_BTi3HXeEc48mhv-aj3MLuYcvwsvkVNrfa43RpSVAARFktORjzX86ItsZvEDrwk9tSjh87IDMj0OdaftPywgk-WxYs9n-URVETGITmPIGDdsAiSvovaeZwOLa-MJkY4Q5H5Sa7hDI3T756c/s1200/Taalbooster%20Logo%20(1).png" 
                alt="TaalBooster" 
                className="h-16 mx-auto mb-6 opacity-80 grayscale hover:grayscale-0 transition-all"
              />
              
              <div className="flex flex-wrap justify-center gap-6 mb-8">
                  <button onClick={() => setSelectedInfo('privacy')} className="text-gray-500 hover:text-[#005B8C] font-medium text-sm transition-colors">
                      Privacy & Gegevens
                  </button>
                  <button onClick={() => setSelectedInfo('terms')} className="text-gray-500 hover:text-[#005B8C] font-medium text-sm transition-colors">
                      Algemene Voorwaarden
                  </button>
                  <button onClick={() => setSelectedInfo('quality')} className="text-gray-500 hover:text-[#005B8C] font-medium text-sm transition-colors">
                      Kwaliteit & Focus
                  </button>
              </div>

              <div className="flex flex-col gap-2 text-gray-400 text-sm">
                  <p>© {new Date().getFullYear()} TaalBooster. Alle rechten voorbehouden.</p>
                  <a href="mailto:info@taalbooster.nl" className="hover:text-[#005B8C] transition-colors">info@taalbooster.nl</a>
              </div>
          </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, color, title, desc }: { icon: React.ReactNode, color: string, title: string, desc: string }) => (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
        <div className={`${color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg rotate-3`}>
            {icon}
        </div>
        <h3 className="text-xl font-heading text-gray-800 mb-3">{title}</h3>
        <p className="text-gray-500 leading-relaxed">{desc}</p>
    </div>
);

export default LandingPage;
