import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Region, SvdStats } from './api';

export type Mode = 'tiles' | 'global';

interface AppState {
  file: File | null;
  setFile: (f: File | null) => void;
  originalUrl: string | null;
  setOriginalUrl: (u: string | null) => void;
  compressedUrl: string | null;
  setCompressedUrl: (u: string | null) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  maxK: number;
  setMaxK: (n: number) => void;
  kBase: number;
  setKBase: (n: number) => void;
  kRegion: number;
  setKRegion: (n: number) => void;
  selectionBox: { x1: number; y1: number; x2: number; y2: number } | null;
  setSelectionBox: (b: AppState['selectionBox']) => void;
  region: Region | null;
  setRegion: (r: Region | null) => void;
  stats: SvdStats | null;
  setStats: (s: SvdStats | null) => void;
  imageDims: { width: number; height: number } | null;
  setImageDims: (d: AppState['imageDims']) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [compressedUrl, setCompressedUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('global');
  const [maxK, setMaxK] = useState(200);
  const [kBase, setKBase] = useState(10);
  const [kRegion, setKRegion] = useState(50);
  const [selectionBox, setSelectionBox] = useState<AppState['selectionBox']>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [stats, setStats] = useState<SvdStats | null>(null);
  const [imageDims, setImageDims] = useState<AppState['imageDims']>(null);

  const value: AppState = {
    file, setFile,
    originalUrl, setOriginalUrl,
    compressedUrl, setCompressedUrl,
    mode, setMode,
    maxK, setMaxK,
    kBase, setKBase,
    kRegion, setKRegion,
    selectionBox, setSelectionBox,
    region, setRegion,
    stats, setStats,
    imageDims, setImageDims,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used within AppProvider');
  return v;
}
