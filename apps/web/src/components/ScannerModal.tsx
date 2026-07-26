import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

type Props = {
  onScan: (text: string) => void;
  onClose: () => void;
};

const REGION_ID = 'saf-scanner-region';

// Support QR plus the common 1D barcode symbologies used on equipment labels.
const FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

// Wide, short scan window: equipment labels are mostly 1D barcodes, which
// decode far more reliably through a letterbox than a QR-style square.
const scanBox = (viewfinderWidth: number, viewfinderHeight: number) => ({
  width: Math.floor(viewfinderWidth * 0.85),
  height: Math.max(120, Math.floor(viewfinderHeight * 0.4)),
});

export const ScannerModal = ({ onScan, onClose }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const handledRef = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // Lifecycle guard: React 18 StrictMode mounts effects twice, and calling
    // stop() while start() is still pending leaves the camera stream locked
    // (black screen). Track the start promise + a cancel flag so cleanup
    // always awaits the start before stopping.
    let cancelled = false;

    const scanner = new Html5Qrcode(REGION_ID, {
      formatsToSupport: FORMATS,
      // Delegate to the browser's native BarcodeDetector when available
      // (Chrome/Android) — dramatically better 1D decoding than the JS port.
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });
    scannerRef.current = scanner;

    const startPromise = scanner
      .start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: scanBox, aspectRatio: 1.333 },
        (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;
          if ('vibrate' in navigator) navigator.vibrate?.(80);
          onScanRef.current(decodedText.trim());
        },
        () => {
          /* per-frame "not found" callbacks are normal — ignore */
        },
      )
      .then(() => {
        if (cancelled) return;
        try {
          setTorchAvailable(scanner.getRunningTrackCameraCapabilities().torchFeature().isSupported());
        } catch {
          /* capabilities unavailable on this device/browser */
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = String(e ?? '');
        setError(
          /NotAllowed|Permission/i.test(msg)
            ? 'Camera access was blocked. Allow camera permission for this site, then try again.'
            : /NotFound|no camera/i.test(msg)
              ? 'No camera found on this device. Type the asset number instead.'
              : 'Could not start the camera. Close any other app using it and try again.',
        );
      });

    return () => {
      cancelled = true;
      void startPromise.finally(() => {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {
            /* already stopped / never started */
          });
      });
    };
  }, []);

  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.getRunningTrackCameraCapabilities().torchFeature().apply(!torchOn);
      setTorchOn((t) => !t);
    } catch {
      setTorchAvailable(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>Scan barcode</h3>
            <p className="subtle">Center the barcode in the window — it scans automatically.</p>
          </div>
        </div>

        <div id={REGION_ID} style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }} />

        {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}

        <div className="actions" style={{ marginTop: 12 }}>
          {torchAvailable && (
            <button type="button" className="secondary-button" onClick={() => void toggleTorch()}>
              {torchOn ? 'Flashlight off' : 'Flashlight on'}
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
