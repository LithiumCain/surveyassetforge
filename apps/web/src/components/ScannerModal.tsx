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

export const ScannerModal = ({ onScan, onClose }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const handledRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(REGION_ID, { formatsToSupport: FORMATS, verbose: false });

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;
          onScanRef.current(decodedText.trim());
        },
        () => {
          /* per-frame "not found" callbacks are normal — ignore */
        },
      )
      .catch((e: unknown) => {
        const msg = String(e ?? '');
        setError(
          /NotAllowed|Permission/i.test(msg)
            ? 'Camera access was blocked. Allow camera permission for this site, then try again.'
            : 'Could not start the camera. Close any other app using it and try again.',
        );
      });

    return () => {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {
          /* already stopped / never started */
        });
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>Scan barcode</h3>
            <p className="subtle">Point your camera at the equipment label.</p>
          </div>
        </div>

        <div id={REGION_ID} style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }} />

        {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}

        <div className="actions" style={{ marginTop: 12 }}>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
