import { useState, useRef } from 'react';
import { useDocumentStore, type DocumentSet } from '../store/documentStore';
import { getFilterStyle } from '../utils/imageProcessing';
import { toast } from 'react-toastify';

export default function DocumentGrid() {
  const documents = useDocumentStore((s) => s.documents);
  const addDocument = useDocumentStore((s) => s.addDocument);
  const removeDocument = useDocumentStore((s) => s.removeDocument);
  const renameDocument = useDocumentStore((s) => s.renameDocument);
  const setImage = useDocumentStore((s) => s.setImage);
  const setEditing = useDocumentStore((s) => s.setEditing);
  const setShowCamera = useDocumentStore((s) => s.setShowCamera);
  const reorderDocuments = useDocumentStore((s) => s.reorderDocuments);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (documents.length === 0) return null;

  const handleDrop = (toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex) {
      reorderDocuments(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Documents{' '}
          <span className="text-gray-400 font-normal">({documents.length})</span>
        </h2>
        <button
          onClick={() => addDocument()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Document
        </button>
      </div>

      <div className="space-y-4">
        {documents.map((doc, index) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            isDragging={dragIndex === index}
            isDragOver={dragOverIndex === index}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e: React.DragEvent) => {
              e.preventDefault();
              setDragOverIndex(index);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onDrop={() => handleDrop(index)}
            onDelete={() => {
              removeDocument(doc.id);
              toast.info('Document deleted');
            }}
            onRename={(name: string) => renameDocument(doc.id, name)}
            onEdit={(side: 'front' | 'back') => setEditing(doc.id, side)}
            onAddImage={(docId: string, side: 'front' | 'back', dataUrl: string) =>
              setImage(docId, side, dataUrl)
            }
            onCameraCapture={(side: 'front' | 'back') =>
              setShowCamera(true, { docId: doc.id, side })
            }
          />
        ))}
      </div>
    </div>
  );
}

interface DocumentCardProps {
  doc: DocumentSet;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onEdit: (side: 'front' | 'back') => void;
  onAddImage: (docId: string, side: 'front' | 'back', dataUrl: string) => void;
  onCameraCapture: (side: 'front' | 'back') => void;
}

function DocumentCard({
  doc,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onDelete,
  onRename,
  onEdit,
  onAddImage,
  onCameraCapture,
}: DocumentCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(doc.name);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect =
    (side: 'front' | 'back') => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        onAddImage(doc.id, side, ev.target?.result as string);
        toast.success(`${side} image added`);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`bg-white rounded-xl border-2 overflow-hidden transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${
        isDragOver
          ? 'border-blue-400 shadow-lg shadow-blue-100'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isRenaming ? (
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => {
                onRename(newName);
                setIsRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRename(newName);
                  setIsRenaming(false);
                }
              }}
              className="text-sm font-medium border border-blue-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-200 w-full mr-2"
            />
          ) : (
            <h3
              className="text-sm font-medium text-gray-700 truncate cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
            >
              <span className="text-gray-300 mr-1">⠿</span>
              {doc.name}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {(doc.front || doc.back) && (
            <button
              onClick={() => onEdit(doc.front ? 'front' : 'back')}
              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
              title="Edit & Enhance"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => {
              setIsRenaming(true);
              setNewName(doc.name);
            }}
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
            title="Rename"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Front & Back Side by Side */}
      <div className="grid grid-cols-2 gap-0 divide-x divide-gray-100">
        {/* Front Side */}
        <ImageSlot
          label="Front Side"
          image={doc.front}
          inputRef={frontInputRef}
          onFileSelect={handleFileSelect('front')}
          onEdit={() => onEdit('front')}
          onCamera={() => onCameraCapture('front')}
          onUploadClick={() => frontInputRef.current?.click()}
        />

        {/* Back Side */}
        <ImageSlot
          label="Back Side"
          image={doc.back}
          inputRef={backInputRef}
          onFileSelect={handleFileSelect('back')}
          onEdit={() => onEdit('back')}
          onCamera={() => onCameraCapture('back')}
          onUploadClick={() => backInputRef.current?.click()}
        />
      </div>
    </div>
  );
}

interface ImageSlotProps {
  label: string;
  image: { original: string; filters: { brightness: number; contrast: number; saturation: number; grayscale: number } } | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEdit: () => void;
  onCamera: () => void;
  onUploadClick: () => void;
}

function ImageSlot({ label, image, inputRef, onFileSelect, onEdit, onCamera, onUploadClick }: ImageSlotProps) {
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          {label}
          {image && <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />}
        </span>
        {image && (
          <button
            onClick={onEdit}
            className="text-[10px] font-medium text-blue-500 hover:text-blue-700 transition-colors"
          >
            Edit
          </button>
        )}
      </div>
      {image ? (
        <div
          className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 cursor-pointer relative group"
          onClick={onEdit}
        >
          <img
            src={image.original}
            alt={label}
            className="w-full h-full object-cover transition-all duration-200"
            style={getFilterStyle(image.filters as import('../store/documentStore').FilterSettings)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-semibold transition-opacity bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
              Edit
            </span>
          </div>
        </div>
      ) : (
        <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileSelect}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={onUploadClick}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"
              title="Upload image"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[9px] font-medium">Upload</span>
            </button>
            <button
              onClick={onCamera}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"
              title="Use camera"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                />
              </svg>
              <span className="text-[9px] font-medium">Camera</span>
            </button>
          </div>
          <p className="text-[10px] text-gray-400">Add {label.toLowerCase()}</p>
        </div>
      )}
    </div>
  );
}
