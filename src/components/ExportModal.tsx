import { useState, useEffect, useCallback } from 'react';
import { useDocumentStore } from '../store/documentStore';
import {
  processImage,
  exportToPDF,
  exportToPDFSideBySide,
  exportAsImage,
  exportAsZip,
  convertToFormat,
  composeSideBySide,
  resizeImage,
  loadImage,
} from '../utils/imageProcessing';
import { toast } from 'react-toastify';

type ExportFormat = 'pdf' | 'png' | 'jpeg' | 'zip';
type LayoutMode = 'side-by-side' | 'separate';

const formatInfo: Record<ExportFormat, { label: string; desc: string; icon: string }> = {
  pdf: { label: 'PDF', desc: 'Multi-page document', icon: '📄' },
  png: { label: 'PNG', desc: 'High quality image', icon: '🖼️' },
  jpeg: { label: 'JPEG', desc: 'Compressed image', icon: '📷' },
  zip: { label: 'ZIP', desc: 'Batch download', icon: '📦' },
};

export default function ExportModal() {
  const documents = useDocumentStore((s) => s.documents);
  const setShowExport = useDocumentStore((s) => s.setShowExport);

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [layout, setLayout] = useState<LayoutMode>('side-by-side');
  const [quality, setQuality] = useState(92);
  const [filename, setFilename] = useState('document');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(
    new Set(documents.map((d) => d.id))
  );
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  // Image resize controls
  const [customSize, setCustomSize] = useState(false);
  const [imgWidth, setImgWidth] = useState(800);
  const [imgHeight, setImgHeight] = useState(600);
  const [lockAspect, setLockAspect] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(800 / 600);

  // Detect aspect ratio from first selected document's front image
  useEffect(() => {
    const detectAspect = async () => {
      const firstDoc = documents.find((d) => selectedDocs.has(d.id) && (d.front || d.back));
      if (!firstDoc) return;
      const imgSrc = firstDoc.front?.original ?? firstDoc.back?.original;
      if (!imgSrc) return;
      try {
        const img = await loadImage(imgSrc);
        const ratio = img.width / img.height;
        setAspectRatio(ratio);
        setImgWidth(img.width > 1200 ? 1200 : img.width);
        setImgHeight(Math.round((img.width > 1200 ? 1200 : img.width) / ratio));
      } catch {
        // ignore
      }
    };
    detectAspect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWidthChange = useCallback(
    (w: number) => {
      setImgWidth(w);
      if (lockAspect) {
        setImgHeight(Math.round(w / aspectRatio));
      }
    },
    [lockAspect, aspectRatio]
  );

  const handleHeightChange = useCallback(
    (h: number) => {
      setImgHeight(h);
      if (lockAspect) {
        setImgWidth(Math.round(h * aspectRatio));
      }
    },
    [lockAspect, aspectRatio]
  );

  const toggleDoc = (id: string) => {
    const next = new Set(selectedDocs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDocs(next);
  };

  const selectAll = () => setSelectedDocs(new Set(documents.map((d) => d.id)));
  const selectNone = () => setSelectedDocs(new Set());

  const getSelectedImages = async () => {
    const images: { name: string; dataUrl: string }[] = [];
    const selectedDocList = documents.filter((d) => selectedDocs.has(d.id));
    const total = selectedDocList.reduce(
      (sum, d) => sum + (d.front ? 1 : 0) + (d.back ? 1 : 0),
      0
    );
    let processed = 0;

    for (const doc of selectedDocList) {
      if (doc.front) {
        let result = await processImage(doc.front.original, doc.front.filters);
        if (customSize) {
          result = await resizeImage(result, imgWidth, imgHeight);
        }
        images.push({ name: `${doc.name}_front`, dataUrl: result });
        processed++;
        setProgress(Math.round((processed / total) * 100));
      }
      if (doc.back) {
        let result = await processImage(doc.back.original, doc.back.filters);
        if (customSize) {
          result = await resizeImage(result, imgWidth, imgHeight);
        }
        images.push({ name: `${doc.name}_back`, dataUrl: result });
        processed++;
        setProgress(Math.round((processed / total) * 100));
      }
    }
    return images;
  };

  const getSelectedPairs = async () => {
    const pairs: { front: string | null; back: string | null; name: string }[] = [];
    const selectedDocList = documents.filter((d) => selectedDocs.has(d.id));
    const total = selectedDocList.reduce(
      (sum, d) => sum + (d.front ? 1 : 0) + (d.back ? 1 : 0),
      0
    );
    let processed = 0;

    for (const doc of selectedDocList) {
      let frontUrl: string | null = null;
      let backUrl: string | null = null;

      if (doc.front) {
        frontUrl = await processImage(doc.front.original, doc.front.filters);
        if (customSize) {
          frontUrl = await resizeImage(frontUrl, imgWidth, imgHeight);
        }
        processed++;
        setProgress(Math.round((processed / total) * 100));
      }
      if (doc.back) {
        backUrl = await processImage(doc.back.original, doc.back.filters);
        if (customSize) {
          backUrl = await resizeImage(backUrl, imgWidth, imgHeight);
        }
        processed++;
        setProgress(Math.round((processed / total) * 100));
      }

      pairs.push({ front: frontUrl, back: backUrl, name: doc.name });
    }
    return pairs;
  };

  // Compose side-by-side images for non-PDF formats
  const getSideBySideImages = async () => {
    const pairs = await getSelectedPairs();
    const composed: { name: string; dataUrl: string }[] = [];

    for (const pair of pairs) {
      if (!pair.front && !pair.back) continue;
      const sizeOpts = customSize ? { width: imgWidth, height: imgHeight } : undefined;
      const dataUrl = await composeSideBySide(pair.front, pair.back, sizeOpts);
      composed.push({ name: pair.name, dataUrl });
    }
    return composed;
  };

  const handleExport = async () => {
    if (selectedDocs.size === 0) {
      toast.warning('Please select at least one document');
      return;
    }

    setIsExporting(true);
    setProgress(0);

    try {
      if (layout === 'side-by-side') {
        // Side-by-side export for all formats
        if (format === 'pdf') {
          const pairs = await getSelectedPairs();
          if (pairs.every((p) => !p.front && !p.back)) {
            toast.warning('No images to export');
            setIsExporting(false);
            return;
          }
          await exportToPDFSideBySide(pairs, `${filename}.pdf`);
        } else {
          const images = await getSideBySideImages();
          if (images.length === 0) {
            toast.warning('No images to export');
            setIsExporting(false);
            return;
          }

          switch (format) {
            case 'png':
              if (images.length === 1) {
                exportAsImage(images[0].dataUrl, `${filename}.png`);
              } else {
                await exportAsZip(
                  images.map((i) => ({ name: `${i.name}.png`, dataUrl: i.dataUrl })),
                  `${filename}.zip`
                );
              }
              break;

            case 'jpeg': {
              const jpegImages = await Promise.all(
                images.map(async (i) => ({
                  name: `${i.name}.jpg`,
                  dataUrl: await convertToFormat(i.dataUrl, 'jpeg', quality / 100),
                }))
              );
              if (jpegImages.length === 1) {
                exportAsImage(jpegImages[0].dataUrl, `${filename}.jpg`);
              } else {
                await exportAsZip(jpegImages, `${filename}.zip`);
              }
              break;
            }

            case 'zip':
              await exportAsZip(
                images.map((i) => ({ name: `${i.name}.png`, dataUrl: i.dataUrl })),
                `${filename}.zip`
              );
              break;
          }
        }
      } else {
        // Separate pages / individual images
        const images = await getSelectedImages();
        if (images.length === 0) {
          toast.warning('No images to export');
          setIsExporting(false);
          return;
        }

        switch (format) {
          case 'pdf':
            await exportToPDF(
              images.map((i) => i.dataUrl),
              `${filename}.pdf`
            );
            break;

          case 'png':
            if (images.length === 1) {
              exportAsImage(images[0].dataUrl, `${filename}.png`);
            } else {
              await exportAsZip(
                images.map((i) => ({ name: `${i.name}.png`, dataUrl: i.dataUrl })),
                `${filename}.zip`
              );
            }
            break;

          case 'jpeg': {
            const jpegImages = await Promise.all(
              images.map(async (i) => ({
                name: `${i.name}.jpg`,
                dataUrl: await convertToFormat(i.dataUrl, 'jpeg', quality / 100),
              }))
            );
            if (jpegImages.length === 1) {
              exportAsImage(jpegImages[0].dataUrl, `${filename}.jpg`);
            } else {
              await exportAsZip(jpegImages, `${filename}.zip`);
            }
            break;
          }

          case 'zip':
            await exportAsZip(
              images.map((i) => ({ name: `${i.name}.png`, dataUrl: i.dataUrl })),
              `${filename}.zip`
            );
            break;
        }
      }

      toast.success('Export completed successfully!');
      setShowExport(false);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed. Please try again.');
    }

    setIsExporting(false);
  };

  const totalImages = documents
    .filter((d) => selectedDocs.has(d.id))
    .reduce((sum, d) => sum + (d.front ? 1 : 0) + (d.back ? 1 : 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Export Documents</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalImages} image{totalImages !== 1 ? 's' : ''} selected for export
            </p>
          </div>
          <button
            onClick={() => setShowExport(false)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Format Selection */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(formatInfo) as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    format === f
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-2xl">{formatInfo[f].icon}</span>
                  <div>
                    <span
                      className={`text-sm font-semibold block ${
                        format === f ? 'text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      {formatInfo[f].label}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatInfo[f].desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Layout Option — available for ALL formats */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              Layout
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLayout('side-by-side')}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  layout === 'side-by-side'
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex gap-0.5 flex-shrink-0">
                  <div className="w-5 h-7 bg-blue-200 rounded-sm border border-blue-300" />
                  <div className="w-5 h-7 bg-blue-200 rounded-sm border border-blue-300" />
                </div>
                <div>
                  <span
                    className={`text-xs font-semibold block ${
                      layout === 'side-by-side' ? 'text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    Side by Side
                  </span>
                  <span className="text-[10px] text-gray-400">Front & back together</span>
                </div>
              </button>
              <button
                onClick={() => setLayout('separate')}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  layout === 'separate'
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <div className="w-5 h-7 bg-gray-200 rounded-sm border border-gray-300" />
                </div>
                <div>
                  <span
                    className={`text-xs font-semibold block ${
                      layout === 'separate' ? 'text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    Separate
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {format === 'pdf' ? 'One image per page' : 'Individual images'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Image Size Controls */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Image Size
              </label>
              <button
                onClick={() => setCustomSize(!customSize)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  customSize
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {customSize ? 'Custom' : 'Original'}
              </button>
            </div>

            {customSize && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                <div className="flex items-center gap-3">
                  {/* Width */}
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={5000}
                      value={imgWidth}
                      onChange={(e) => handleWidthChange(Math.max(50, Number(e.target.value)))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                    />
                  </div>

                  {/* Lock aspect ratio toggle */}
                  <button
                    onClick={() => {
                      if (!lockAspect) {
                        // Re-lock: recalculate aspect from current values
                        setAspectRatio(imgWidth / imgHeight);
                      }
                      setLockAspect(!lockAspect);
                    }}
                    className={`mt-5 p-2 rounded-lg transition-colors ${
                      lockAspect
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                    }`}
                    title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {lockAspect ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                        />
                      )}
                    </svg>
                  </button>

                  {/* Height */}
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={5000}
                      value={imgHeight}
                      onChange={(e) => handleHeightChange(Math.max(50, Number(e.target.value)))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                    />
                  </div>
                </div>

                {/* Quick presets */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'HD', w: 1280, h: 720 },
                    { label: 'Full HD', w: 1920, h: 1080 },
                    { label: 'A4 @150dpi', w: 1240, h: 1754 },
                    { label: 'Square', w: 1000, h: 1000 },
                    { label: 'ID Card', w: 1012, h: 638 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setImgWidth(preset.w);
                        setImgHeight(preset.h);
                        setAspectRatio(preset.w / preset.h);
                      }}
                      className="px-2.5 py-1 text-[10px] font-medium bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                    >
                      {preset.label}
                      <span className="text-gray-400 ml-1">
                        {preset.w}×{preset.h}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filename */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              Filename
            </label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-400">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm outline-none"
                placeholder="Enter filename"
              />
              <span className="px-3 py-2.5 text-sm text-gray-400 bg-gray-50 border-l border-gray-200">
                .{format === 'zip' ? 'zip' : format === 'jpeg' ? 'jpg' : format}
              </span>
            </div>
          </div>

          {/* Quality (for JPEG) */}
          {format === 'jpeg' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                Quality: <span className="text-blue-600">{quality}%</span>
              </label>
              <input
                type="range"
                min={10}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>Smaller file</span>
                <span>Higher quality</span>
              </div>
            </div>
          )}

          {/* Document Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Select Documents ({selectedDocs.size}/{documents.length})
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                >
                  All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={selectNone}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                >
                  None
                </button>
              </div>
            </div>
            <div className="space-y-1 max-h-44 overflow-y-auto rounded-lg border border-gray-200 p-1">
              {documents.map((doc) => {
                const sides = [doc.front && 'Front', doc.back && 'Back'].filter(Boolean);
                return (
                  <label
                    key={doc.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      selectedDocs.has(doc.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocs.has(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-blue-200"
                    />
                    <span className="text-sm text-gray-700 flex-1 truncate">{doc.name}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {sides.join(' + ') || 'Empty'}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {isExporting && (
          <div className="px-6 pb-2">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">
              Processing images... {progress}%
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={() => setShowExport(false)}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedDocs.size === 0 || totalImages === 0}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md shadow-blue-200"
          >
            {isExporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Exporting...
              </>
            ) : (
              <>
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export {formatInfo[format].label}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
