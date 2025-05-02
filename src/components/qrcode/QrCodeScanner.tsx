import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Scan, X } from 'lucide-react';

interface QrCodeScannerProps {
  onScan: (data: string) => void;
  autoStart?: boolean;
}

const QrCodeScanner: React.FC<QrCodeScannerProps> = ({ 
  onScan,
  autoStart = false
}) => {
  const [isScanning, setIsScanning] = useState(autoStart);
  const [error, setError] = useState<string | null>(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-scanner-container';

  useEffect(() => {
    // Inicializa o scanner
    scannerRef.current = new Html5Qrcode(scannerContainerId);
    
    // Verifica permissões da câmera
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => {
          setPermissionsGranted(true);
          if (autoStart) {
            startScanner();
          }
        })
        .catch(err => {
          console.error('Erro ao acessar câmera:', err);
          setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        });
    } else {
      setError('Seu navegador não suporta acesso à câmera.');
    }
    
    // Cleanup na desmontagem
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error(err));
      }
    };
  }, [autoStart]);

  const startScanner = () => {
    if (!scannerRef.current || !permissionsGranted) return;
    
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };
    
    scannerRef.current.start(
      { facingMode: 'environment' },
      config,
      onQrCodeSuccess,
      onQrCodeError
    )
    .then(() => {
      setIsScanning(true);
      setError(null);
    })
    .catch(err => {
      console.error('Erro ao iniciar scanner:', err);
      setError('Erro ao iniciar o scanner: ' + err.toString());
    });
  };

  const stopScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop()
        .then(() => {
          setIsScanning(false);
        })
        .catch(err => {
          console.error('Erro ao parar scanner:', err);
        });
    }
  };

  const onQrCodeSuccess = (decodedText: string) => {
    // Envia o valor decodificado para o callback
    onScan(decodedText);
    
    // Opcional: parar o scanner após uma leitura bem-sucedida
    // stopScanner();
  };

  const onQrCodeError = (errorMessage: string) => {
    // Erros de decodificação podem ser ignorados, pois são comuns durante o escaneamento
    // console.log('QR code error:', errorMessage);
  };

  const toggleScanner = () => {
    if (isScanning) {
      stopScanner();
    } else {
      startScanner();
    }
  };

  return (
    <div className="qr-scanner-wrapper">
      {error && (
        <div className="bg-error-light text-error p-3 mb-4 rounded flex items-start">
          <span className="mr-2">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      
      <div className="flex justify-center mb-4">
        <button
          onClick={toggleScanner}
          className={`btn ${isScanning ? 'btn-outline' : 'btn-primary'} flex items-center`}
          disabled={!permissionsGranted}
        >
          {isScanning ? (
            <>
              <X className="w-5 h-5 mr-2" />
              Parar Scanner
            </>
          ) : (
            <>
              <Scan className="w-5 h-5 mr-2" />
              Iniciar Scanner
            </>
          )}
        </button>
      </div>
      
      <div 
        id={scannerContainerId}
        className={`overflow-hidden bg-black rounded-lg ${isScanning ? 'block' : 'hidden'}`}
        style={{ width: '100%', maxWidth: '400px', height: '300px', margin: '0 auto' }}
      />
      
      {isScanning && (
        <div className="text-center mt-4 text-sm text-gray-600">
          Posicione o QR code no centro da câmera para escaneá-lo.
        </div>
      )}
    </div>
  );
};

export default QrCodeScanner;