import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDocumentStore } from '../store/documentStore';
import { toast } from 'react-toastify';

interface UploadAreaProps {
  targetDocId?: string;
  targetSide?: 'front' | 'back';
  compact?: boolean;
  onUploaded?: () => void;
}

export default function UploadArea({ targetDocId, targetSide, compact, onUploaded }: UploadAreaProps) {
  const addDocument = useDocumentStore((s) => s.addDocument);
  const setImage = useDocumentStore((s) => s.setImage);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (targetDocId && targetSide) {
            setImage(targetDocId, targetSide, dataUrl);
            toast.success(`Added ${targetSide} image`);
          } else {
            const docId = addDocument();
            setImage(docId, 'front', dataUrl);
            toast.success(`Document created (${index + 1}/${acceptedFiles.length})`);
          }
          onUploaded?.();
        };
        reader.readAsDataURL(file);
      });
    },
    [targetDocId, targetSide, addDocument, setImage, onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.heic', '.webp', '.bmp'] },
    multiple: !targetDocId,
  });

  if (compact) {
    return (
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-gray-500">
          {isDragActive ? 'Drop here' : 'Click or drag to add image'}
        </p>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 ${
        isDragActive
          ? 'border-blue-500 bg-blue-50/80 scale-[1.01] shadow-lg shadow-blue-100'
          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50/80'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>
        <div>
          <p className="text-lg sm:text-xl font-semibold text-gray-700">
            {isDragActive ? 'Drop your files here' : 'Drag & drop documents here'}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            or click to browse • Supports PNG, JPEG, HEIC, WebP
          </p>
          <p className="text-xs text-gray-400 mt-1">Upload multiple files for batch scanning</p>
        </div>
      </div>
    </div>
  );
}
