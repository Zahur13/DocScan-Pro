import { useDocumentStore } from './store/documentStore';
import UploadArea from './components/UploadArea';
import DocumentGrid from './components/DocumentGrid';
import ImageEditor from './components/ImageEditor';
import CameraModal from './components/CameraModal';
import ExportModal from './components/ExportModal';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function App() {
  const documents = useDocumentStore((s) => s.documents);
  const showCamera = useDocumentStore((s) => s.showCamera);
  const showExport = useDocumentStore((s) => s.showExport);
  const editingDocId = useDocumentStore((s) => s.editingDocId);
  const setShowCamera = useDocumentStore((s) => s.setShowCamera);
  const setShowExport = useDocumentStore((s) => s.setShowExport);

  const totalImages = documents.reduce(
    (sum, d) => sum + (d.front ? 1 : 0) + (d.back ? 1 : 0),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  DocScan Pro
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-400 -mt-0.5 hidden sm:block">
                  Document Scanner & Enhancer
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Stats Badge */}
              {documents.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{documents.length}</span> doc
                  {documents.length !== 1 ? 's' : ''}
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span className="font-medium text-gray-700">{totalImages}</span> image
                  {totalImages !== 1 ? 's' : ''}
                </div>
              )}

              {/* Camera Button */}
              <button
                onClick={() => setShowCamera(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all hover:shadow-sm"
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
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="hidden sm:inline">Camera</span>
              </button>

              {/* Export Button */}
              {documents.length > 0 && totalImages > 0 && (
                <button
                  onClick={() => setShowExport(true)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300"
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span className="hidden sm:inline">Export</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Upload Area */}
        <UploadArea />

        {/* Document Grid */}
        <DocumentGrid />

        {/* Empty State */}
        {documents.length === 0 && (
          <div className="mt-16 text-center">
            <div className="inline-flex items-center justify-center w-28 h-28 bg-gradient-to-br from-gray-100 to-gray-50 rounded-3xl mb-8 shadow-inner">
              <svg
                className="w-14 h-14 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={0.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-600 mb-3">No documents yet</h3>
            <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
              Upload images or use the camera to start scanning documents. You can pair front and
              back sides, apply filters, and export in multiple formats.
            </p>

            {/* Steps */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              <StepIndicator number={1} title="Upload or Capture" desc="Add document images" />
              <div className="hidden sm:block w-8 h-px bg-gray-200" />
              <StepIndicator number={2} title="Enhance & Edit" desc="Apply filters & adjust" />
              <div className="hidden sm:block w-8 h-px bg-gray-200" />
              <StepIndicator number={3} title="Export" desc="PDF, PNG, JPEG, or ZIP" />
            </div>

            {/* Feature highlights */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
              <FeatureCard icon="📸" title="Camera Capture" />
              <FeatureCard icon="🎨" title="Image Filters" />
              <FeatureCard icon="📑" title="Front & Back" />
              <FeatureCard icon="📤" title="Multi-format Export" />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-xs text-gray-400">
        <p>DocScan Pro — Scan, enhance, and export documents with ease</p>
      </footer>

      {/* Modals */}
      {editingDocId && <ImageEditor />}
      {showCamera && <CameraModal />}
      {showExport && <ExportModal />}

      {/* Toast Container */}
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        toastClassName="text-sm"
      />
    </div>
  );
}

function StepIndicator({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-blue-600">{number}</span>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-gray-500">{title}</span>
    </div>
  );
}
