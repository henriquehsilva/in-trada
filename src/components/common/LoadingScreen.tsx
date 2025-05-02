import { Loader } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="flex items-center justify-center w-full h-screen bg-gray-50">
      <div className="text-center">
        <Loader className="w-12 h-12 mx-auto text-primary animate-spin" />
        <p className="mt-4 text-lg font-medium text-primary">Carregando...</p>
      </div>
    </div>
  );
};