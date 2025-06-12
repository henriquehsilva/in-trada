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
    console.debug('[QrScanner] Solicitando permissão de câmera...');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => {
          console.debug('[QrScanner] Permissão concedida.');
          setPermissionsGranted(true);
        })
        .catch(err => {
          console.error('[QrScanner] Erro ao acessar câmera:', err);
          setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        });
    } else {
      console.warn('[QrScanner] Navegador não suporta getUserMedia.');
      setError('Seu navegador não suporta acesso à câmera.');
    }
  }, []);

  useEffect(() => {
    const initializeScanner = async () => {
      const container = document.getElementById(scannerContainerId);
      if (!container) {
        console.warn('[QrScanner] Container ainda não disponível. Tentando novamente em breve...');
        setTimeout(initializeScanner, 200); // tenta novamente depois que o DOM montar
        return;
      }

      if (permissionsGranted && !scannerRef.current) {
        try {
          scannerRef.current = new Html5Qrcode(scannerContainerId);
          console.debug('[QrScanner] Scanner instanciado.');

          if (autoStart) {
            console.debug('[QrScanner] autoStart ativado, chamando startScanner...');
            startScanner();
          }
        } catch (err) {
          console.error('[QrScanner] Erro ao instanciar Html5Qrcode:', err);
          setError('Erro ao iniciar o scanner: ' + (err as Error).message);
        }
      }
    };

    initializeScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().then(() => {
          console.debug('[QrScanner] Scanner parado no unmount.');
        }).catch(err => {
          console.error('[QrScanner] Falha ao parar scanner no unmount:', err);
        });
      }
    };
  }, [permissionsGranted, autoStart]);

  const startScanner = () => {
    if (!scannerRef.current || !permissionsGranted) {
      console.warn('[QrScanner] startScanner chamado sem permissões ou scanner nulo.');
      return;
    }

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    console.debug('[QrScanner] Iniciando scanner com config:', config);

    scannerRef.current
      .start(
        { facingMode: 'environment' },
        config,
        onQrCodeSuccess,
        onQrCodeError
      )
      .then(() => {
        console.debug('[QrScanner] Scanner iniciado com sucesso.');
        const video = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement;
        if (video) {
          video.style.width = '100%';
          video.style.height = '100%';
        }
        setIsScanning(true);
        setError(null);
      })
      .catch(err => {
        console.error('[QrScanner] Erro ao iniciar scanner:', err);
        setError('Erro ao iniciar o scanner: ' + err.toString());
      });
  };

  const stopScanner = () => {
    if (scannerRef.current?.isScanning) {
      console.debug('[QrScanner] Parando scanner...');
      scannerRef.current
        .stop()
        .then(() => {
          console.debug('[QrScanner] Scanner parado.');
          setIsScanning(false);
        })
        .catch(err => {
          console.error('[QrScanner] Erro ao parar scanner:', err);
        });
    } else {
      console.debug('[QrScanner] Scanner já está parado.');
    }
  };

  const onQrCodeSuccess = (decodedText: string) => {
    console.debug('[QrScanner] QR code lido com sucesso:', decodedText);
    onScan(decodedText);
    // stopScanner(); // opcional
  };

  const onQrCodeError = (errorMessage: string) => {
    // Silencie erros de leitura, são esperados
    console.debug('[QrScanner] Falha na leitura:', errorMessage);
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
