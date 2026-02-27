import { useState, useEffect } from 'react';
import { useDocumentStore, defaultFilters, type FilterSettings } from '../store/documentStore';
import { presets, getFilterStyle } from '../utils/imageProcessing';

export default function ImageEditor() {
  const documents = useDocumentStore((s) => s.documents);
  const editingDocId = useDocumentStore((s) => s.editingDocId);
  const editingSide = useDocumentStore((s) => s.editingSide);
  const setEditing = useDocumentStore((s) => s.setEditing);
  const updateFilters = useDocumentStore((s) => s.updateFilters);
  const removeImage = useDocumentStore((s) => s.removeImage);

  const [activeSide, setActiveSide] = useState<'front' | 'back'>(editingSide);

  const doc = documents.find((d) => d.id === editingDocId);

  useEffect(() => {
    setActiveSide(editingSide);
  }, [editingSide]);

  // Lock body scroll when editor is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!doc || !editingDocId) return null;

  const currentImage = doc[activeSide];
  const filters = currentImage?.filters || defaultFilters;

  const handleFilterChange = (key: keyof FilterSettings, value: number) => {
    if (!currentImage) return;
    updateFilters(editingDocId, activeSide, { ...filters, [key]: value });
  };

  const applyPreset = (presetName: string) => {
    if (!currentImage) return;
    const preset = presets[presetName];
    updateFilters(editingDocId, activeSide, {
      ...filters,
      ...preset,
      rotation: preset.rotation !== undefined ? preset.rotation : filters.rotation,
    });
  };

  const resetFilters = () => {
    if (!currentImage) return;
    updateFilters(editingDocId, activeSide, { ...defaultFilters });
  };

  const rotate = () => {
    if (!currentImage) return;
    updateFilters(editingDocId, activeSide, {
      ...filters,
      rotation: (filters.rotation + 90) % 360,
    });
  };

  const close = () => setEditing(null);

  const handleRemoveImage = () => {
    removeImage(editingDocId, activeSide);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 truncate">{doc.name}</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Editing <span className="capitalize font-medium text-blue-600">{activeSide}</span> side
              {filters.rotation > 0 && <span className="ml-2 text-gray-400">• Rotated {filters.rotation}°</span>}
            </p>
          </div>
          <button
            onClick={close}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* Side selector tabs */}
          <div className="flex lg:flex-col border-b lg:border-b-0 lg:border-r border-gray-200 flex-shrink-0">
            {(['front', 'back'] as const).map((side) => (
              <button
                key={side}
                onClick={() => setActiveSide(side)}
                className={`flex-1 lg:flex-none px-4 sm:px-6 py-3 text-sm font-medium capitalize transition-colors relative ${
                  activeSide === side
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  {side}
                  {doc[side] ? (
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                  )}
                </span>
                {activeSide === side && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 lg:h-auto lg:bottom-auto lg:top-0 lg:right-0 lg:left-auto lg:w-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </div>

          {/* Image Preview */}
          <div className="flex-1 flex items-center justify-center bg-gray-100 p-4 sm:p-6 min-h-0 overflow-hidden relative">
            {currentImage ? (
              <div className="max-w-full max-h-full overflow-hidden rounded-lg shadow-xl bg-white">
                <img
                  src={currentImage.original}
                  alt={`${activeSide} side`}
                  className="max-w-full max-h-[55vh] lg:max-h-[70vh] object-contain block"
                  style={{
                    ...getFilterStyle(filters),
                    transition: 'filter 0.2s ease, transform 0.3s ease',
                  }}
                />
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <svg
                  className="w-20 h-20 mx-auto mb-4 text-gray-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={0.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zM9 9h.008v.008H9V9z"
                  />
                </svg>
                <p className="text-lg font-medium text-gray-400">No image on this side</p>
                <p className="text-sm mt-1 text-gray-300">
                  Go back and upload or capture an image
                </p>
              </div>
            )}

            {/* Side-by-side mini preview */}
            {doc.front && doc.back && (
              <div className="absolute bottom-3 left-3 flex gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg p-1.5 shadow-md">
                <button
                  onClick={() => setActiveSide('front')}
                  className={`w-12 h-16 rounded overflow-hidden border-2 transition-colors ${
                    activeSide === 'front' ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <img
                    src={doc.front.original}
                    alt="Front"
                    className="w-full h-full object-cover"
                    style={getFilterStyle(doc.front.filters)}
                  />
                </button>
                <button
                  onClick={() => setActiveSide('back')}
                  className={`w-12 h-16 rounded overflow-hidden border-2 transition-colors ${
                    activeSide === 'back' ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <img
                    src={doc.back.original}
                    alt="Back"
                    className="w-full h-full object-cover"
                    style={getFilterStyle(doc.back.filters)}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Controls Panel */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col flex-shrink-0 max-h-[40vh] lg:max-h-none overflow-y-auto">
            {currentImage ? (
              <div className="p-4 sm:p-5 space-y-5">
                {/* Adjustments */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Adjustments
                  </h3>
                  <div className="space-y-3">
                    <SliderControl
                      label="Brightness"
                      icon="☀️"
                      value={filters.brightness}
                      min={50}
                      max={200}
                      defaultVal={100}
                      onChange={(v) => handleFilterChange('brightness', v)}
                    />
                    <SliderControl
                      label="Contrast"
                      icon="◐"
                      value={filters.contrast}
                      min={50}
                      max={200}
                      defaultVal={100}
                      onChange={(v) => handleFilterChange('contrast', v)}
                    />
                    <SliderControl
                      label="Saturation"
                      icon="🎨"
                      value={filters.saturation}
                      min={0}
                      max={200}
                      defaultVal={100}
                      onChange={(v) => handleFilterChange('saturation', v)}
                    />
                    <SliderControl
                      label="Sharpness"
                      icon="🔍"
                      value={filters.sharpness}
                      min={0}
                      max={100}
                      defaultVal={0}
                      onChange={(v) => handleFilterChange('sharpness', v)}
                    />
                    <SliderControl
                      label="Grayscale"
                      icon="⬛"
                      value={filters.grayscale}
                      min={0}
                      max={100}
                      defaultVal={0}
                      onChange={(v) => handleFilterChange('grayscale', v)}
                    />
                  </div>
                </div>

                {/* Presets */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Filter Presets
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.keys(presets).map((name) => (
                      <button
                        key={name}
                        onClick={() => applyPreset(name)}
                        className="px-3 py-2 text-xs font-medium capitalize bg-gray-50 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors border border-gray-100 hover:border-blue-200"
                      >
                        {name === 'b&w' ? 'B & W' : name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={rotate}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Rotate 90°
                  </button>
                  <button
                    onClick={resetFilters}
                    className="w-full py-2.5 text-sm font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    Reset to Original
                  </button>
                  <button
                    onClick={handleRemoveImage}
                    className="w-full py-2.5 text-sm font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Remove Image
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                <svg
                  className="w-12 h-12 mb-3 text-gray-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <p className="text-sm font-medium">No image to edit</p>
                <p className="text-xs mt-1">Upload an image for this side first</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SliderControlProps {
  label: string;
  icon: string;
  value: number;
  min: number;
  max: number;
  defaultVal: number;
  onChange: (value: number) => void;
}

function SliderControl({ label, icon, value, min, max, defaultVal, onChange }: SliderControlProps) {
  const isDefault = value === defaultVal;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          {label}
        </span>
        <button
          onClick={() => onChange(defaultVal)}
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
            isDefault
              ? 'text-gray-400 bg-gray-50'
              : 'text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer'
          }`}
        >
          {value}
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}
