import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './src/pages/LandingPage';
import SchoolWorkspace from './src/pages/SchoolWorkspace';
import DemoWorkspace from './src/pages/DemoWorkspace';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/eenbes" element={<SchoolWorkspace />} />
        <Route path="/demo" element={<DemoWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
