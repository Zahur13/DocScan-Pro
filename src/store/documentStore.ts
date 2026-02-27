import { create } from 'zustand';

export interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  grayscale: number;
  rotation: number;
}

export const defaultFilters: FilterSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpness: 0,
  grayscale: 0,
  rotation: 0,
};

export interface ScannedImage {
  id: string;
  original: string;
  filters: FilterSettings;
}

export interface DocumentSet {
  id: string;
  name: string;
  front: ScannedImage | null;
  back: ScannedImage | null;
  createdAt: number;
}

interface DocumentState {
  documents: DocumentSet[];
  editingDocId: string | null;
  editingSide: 'front' | 'back';
  showCamera: boolean;
  showExport: boolean;
  cameraTarget: { docId: string; side: 'front' | 'back' } | null;
}

interface DocumentActions {
  addDocument: (name?: string) => string;
  removeDocument: (id: string) => void;
  renameDocument: (id: string, name: string) => void;
  setImage: (docId: string, side: 'front' | 'back', imageDataUrl: string) => void;
  removeImage: (docId: string, side: 'front' | 'back') => void;
  updateFilters: (docId: string, side: 'front' | 'back', filters: FilterSettings) => void;
  setEditing: (docId: string | null, side?: 'front' | 'back') => void;
  setShowCamera: (show: boolean, target?: { docId: string; side: 'front' | 'back' } | null) => void;
  setShowExport: (show: boolean) => void;
  reorderDocuments: (fromIndex: number, toIndex: number) => void;
}

type DocumentStore = DocumentState & DocumentActions;

let counter = 0;
const genId = () => `${Date.now()}_${++counter}_${Math.random().toString(36).slice(2, 7)}`;

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  editingDocId: null,
  editingSide: 'front',
  showCamera: false,
  showExport: false,
  cameraTarget: null,

  addDocument: (name) => {
    const id = genId();
    const docNum = get().documents.length + 1;
    set((s) => ({
      documents: [
        ...s.documents,
        {
          id,
          name: name || `Document ${docNum}`,
          front: null,
          back: null,
          createdAt: Date.now(),
        },
      ],
    }));
    return id;
  },

  removeDocument: (id) =>
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
      editingDocId: s.editingDocId === id ? null : s.editingDocId,
    })),

  renameDocument: (id, name) =>
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, name } : d)),
    })),

  setImage: (docId, side, imageDataUrl) => {
    const imgId = genId();
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === docId
          ? {
              ...d,
              [side]: {
                id: imgId,
                original: imageDataUrl,
                filters: { ...defaultFilters },
              } as ScannedImage,
            }
          : d
      ),
    }));
  },

  removeImage: (docId, side) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === docId ? { ...d, [side]: null } : d
      ),
    })),

  updateFilters: (docId, side, filters) =>
    set((s) => ({
      documents: s.documents.map((d) => {
        if (d.id !== docId || !d[side]) return d;
        return {
          ...d,
          [side]: { ...d[side]!, filters },
        };
      }),
    })),

  setEditing: (docId, side) =>
    set({ editingDocId: docId, editingSide: side || 'front' }),

  setShowCamera: (show, target) =>
    set({ showCamera: show, cameraTarget: target || null }),

  setShowExport: (show) => set({ showExport: show }),

  reorderDocuments: (fromIndex, toIndex) =>
    set((s) => {
      const docs = [...s.documents];
      const [moved] = docs.splice(fromIndex, 1);
      docs.splice(toIndex, 0, moved);
      return { documents: docs };
    }),
}));
