import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './routes/HomePage';
import RankingPage from './routes/RankingPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
