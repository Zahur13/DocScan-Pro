import { useRef, useState, useEffect, useCallback } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { toast } from 'react-toastify';

export default function CameraModal() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoDetectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [autoMode, setAutoMode] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionScore, setDetectionScore] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setShowCamera = useDocumentStore((s) => s.setShowCamera);
  const cameraTarget = useDocumentStore((s) => s.cameraTarget);
  const addDocument = useDocumentStore((s) => s.addDocument);
  const setImage = useDocumentStore((s) => s.setImage);

  useEffect(() => {
    const start = async () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setError(null);
      } catch {
        setError('Camera access denied or not available. Please check permissions.');
      }
    };

    start();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  // Auto-detect document edges using canvas analysis
  const detectDocument = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return 0;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.videoWidth === 0) return 0;

    canvas.width = 320;
    canvas.height = 240;
    ctx.drawImage(video, 0, 0, 320, 240);

    const imageData = ctx.getImageData(0, 0, 320, 240);
    const data = imageData.data;

    // Simple edge detection: look for contrast differences
    // that indicate a document is present in the frame
    let edgeCount = 0;
    let totalPixels = 0;
    const threshold = 30;

    // Analyze the center region (where the document guide is)
    const startX = Math.floor(320 * 0.1);
    const endX = Math.floor(320 * 0.9);
    const startY = Math.floor(240 * 0.15);
    const endY = Math.floor(240 * 0.85);

    for (let y = startY + 1; y < endY - 1; y++) {
      for (let x = startX + 1; x < endX - 1; x++) {
        const idx = (y * 320 + x) * 4;
        const idxRight = (y * 320 + (x + 1)) * 4;
        const idxDown = ((y + 1) * 320 + x) * 4;

        // Grayscale values
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const grayRight = (data[idxRight] + data[idxRight + 1] + data[idxRight + 2]) / 3;
        const grayDown = (data[idxDown] + data[idxDown + 1] + data[idxDown + 2]) / 3;

        const diffH = Math.abs(gray - grayRight);
        const diffV = Math.abs(gray - grayDown);

        if (diffH > threshold || diffV > threshold) {
          edgeCount++;
        }
        totalPixels++;
      }
    }

    // Calculate edge density as a percentage
    const edgeDensity = (edgeCount / totalPixels) * 100;

    // Also check for brightness uniformity in center (document tends to be lighter)
    let centerBrightness = 0;
    let centerCount = 0;
    const cStartX = Math.floor(320 * 0.25);
    const cEndX = Math.floor(320 * 0.75);
    const cStartY = Math.floor(240 * 0.25);
    const cEndY = Math.floor(240 * 0.75);

    for (let y = cStartY; y < cEndY; y += 2) {
      for (let x = cStartX; x < cEndX; x += 2) {
        const idx = (y * 320 + x) * 4;
        centerBrightness += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        centerCount++;
      }
    }
    const avgBrightness = centerBrightness / centerCount;

    // Score: combination of edge density and brightness
    // Good document: moderate edges (3-15%) and decent brightness (>100)
    let score = 0;
    if (edgeDensity >= 2 && edgeDensity <= 20) {
      score += Math.min(50, edgeDensity * 5);
    }
    if (avgBrightness > 80) {
      score += Math.min(50, (avgBrightness / 255) * 50);
    }

    return Math.min(100, Math.round(score));
  }, []);

  // Auto-capture when document is detected with high confidence
  useEffect(() => {
    if (!autoMode || capturedImage || error) {
      if (autoDetectIntervalRef.current) {
        clearInterval(autoDetectIntervalRef.current);
        autoDetectIntervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setIsDetecting(false);
      setCountdown(null);
      return;
    }

    setIsDetecting(true);
    let stableFrames = 0;
    const requiredStableFrames = 8; // ~1.6 seconds of stable detection

    autoDetectIntervalRef.current = setInterval(() => {
      const score = detectDocument();
      setDetectionScore(score);

      if (score >= 60) {
        stableFrames++;
        if (stableFrames >= requiredStableFrames && !countdown) {
          // Start countdown
          setCountdown(3);
          let count = 3;
          countdownRef.current = setInterval(() => {
            count--;
            if (count <= 0) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              countdownRef.current = null;
              setCountdown(null);
              capture();
            } else {
              setCountdown(count);
            }
          }, 1000);
        }
      } else {
        stableFrames = 0;
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          setCountdown(null);
        }
      }
    }, 200);

    return () => {
      if (autoDetectIntervalRef.current) {
        clearInterval(autoDetectIntervalRef.current);
        autoDetectIntervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, capturedImage, error, detectDocument]);

  const capture = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.95));
    // Stop auto-detection
    if (autoDetectIntervalRef.current) {
      clearInterval(autoDetectIntervalRef.current);
      autoDetectIntervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
    setIsDetecting(false);
  }, []);

  const useImage = () => {
    if (!capturedImage) return;
    if (cameraTarget) {
      setImage(cameraTarget.docId, cameraTarget.side, capturedImage);
      toast.success(`Added ${cameraTarget.side} image`);
    } else {
      const docId = addDocument();
      setImage(docId, 'front', capturedImage);
      toast.success('Document created from camera');
    }
    close();
  };

  const retake = () => {
    setCapturedImage(null);
    setDetectionScore(0);
  };

  const close = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (autoDetectIntervalRef.current) {
      clearInterval(autoDetectIntervalRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    setShowCamera(false);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const toggleAutoMode = () => {
    setAutoMode((prev) => !prev);
    setCountdown(null);
    setDetectionScore(0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Hidden canvas for detection */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent absolute top-0 left-0 right-0 z-10">
        <button
          onClick={close}
          className="text-white p-2 hover:bg-white/20 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 className="text-white font-semibold text-lg">
          {cameraTarget ? `Capture ${cameraTarget.side}` : 'Capture Document'}
        </h3>
        <button
          onClick={toggleCamera}
          className="text-white p-2 hover:bg-white/20 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Camera/Preview */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-white text-center p-8">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-lg font-medium">{error}</p>
            <p className="text-sm text-gray-400 mt-2">
              Please allow camera access in your browser settings and try again
            </p>
          </div>
        ) : capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* Document Outline Overlay */}
      {!capturedImage && !error && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            className={`w-[80%] h-[70%] max-w-lg max-h-96 border-2 rounded-2xl transition-colors duration-300 ${
              detectionScore >= 60
                ? 'border-green-400/60'
                : detectionScore >= 30
                ? 'border-yellow-400/40'
                : 'border-white/30'
            }`}
          >
            <div
              className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-2xl transition-colors duration-300 ${
                detectionScore >= 60 ? 'border-green-400' : 'border-white'
              }`}
            />
            <div
              className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-2xl transition-colors duration-300 ${
                detectionScore >= 60 ? 'border-green-400' : 'border-white'
              }`}
            />
            <div
              className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-2xl transition-colors duration-300 ${
                detectionScore >= 60 ? 'border-green-400' : 'border-white'
              }`}
            />
            <div
              className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-2xl transition-colors duration-300 ${
                detectionScore >= 60 ? 'border-green-400' : 'border-white'
              }`}
            />
          </div>

          {/* Countdown overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <span className="text-white text-5xl font-bold animate-pulse">{countdown}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto-detect status bar */}
      {!capturedImage && !error && autoMode && isDetecting && (
        <div className="absolute bottom-32 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  detectionScore >= 60
                    ? 'bg-green-400 animate-pulse'
                    : detectionScore >= 30
                    ? 'bg-yellow-400'
                    : 'bg-gray-400'
                }`}
              />
              <span className="text-white text-xs font-medium">
                {detectionScore >= 60
                  ? 'Document detected — hold steady'
                  : detectionScore >= 30
                  ? 'Aligning...'
                  : 'Looking for document...'}
              </span>
            </div>
            {/* Detection score bar */}
            <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  detectionScore >= 60
                    ? 'bg-green-400'
                    : detectionScore >= 30
                    ? 'bg-yellow-400'
                    : 'bg-gray-400'
                }`}
                style={{ width: `${detectionScore}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-6 bg-gradient-to-t from-black/70 to-transparent flex flex-col items-center gap-4">
        {capturedImage ? (
          <div className="flex items-center gap-6">
            <button
              onClick={retake}
              className="px-8 py-3 bg-white/20 text-white rounded-full font-medium hover:bg-white/30 transition-colors backdrop-blur-sm"
            >
              Retake
            </button>
            <button
              onClick={useImage}
              className="px-10 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
            >
              Use Photo
            </button>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={toggleAutoMode}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
                  autoMode
                    ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
                    : 'bg-white/20 text-white/70 hover:bg-white/30'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                    />
                  </svg>
                  Auto
                </span>
              </button>
              <button
                onClick={toggleAutoMode}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
                  !autoMode
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                    : 'bg-white/20 text-white/70 hover:bg-white/30'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                    />
                  </svg>
                  Manual
                </span>
              </button>
            </div>

            {/* Capture button (always visible for manual, also as override in auto) */}
            <button
              onClick={capture}
              disabled={!!error}
              className="w-20 h-20 rounded-full border-4 border-white bg-white/10 hover:bg-white/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center group"
            >
              <div className="w-14 h-14 rounded-full bg-white group-hover:scale-95 transition-transform" />
            </button>
            <p className="text-white/50 text-[10px] font-medium">
              {autoMode
                ? 'Auto-capture enabled • Tap to capture manually'
                : 'Tap the button to capture'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
