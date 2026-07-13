import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './AppContext';
import Layout from './Layout';
import Compressor from './pages/Compressor';
import Teoria from './pages/Teoria';
import Analise from './pages/Analise';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Compressor />} />
            <Route path="/teoria" element={<Teoria />} />
            <Route path="/analise" element={<Analise />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
