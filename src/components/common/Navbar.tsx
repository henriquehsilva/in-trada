import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, ChevronDown } from 'lucide-react';
import { useAuth, UserRole } from '../../contexts/AuthContext';

interface NavItem {
  label: string;
  href: string;
}

interface NavbarProps {
  role: UserRole;
}

const Navbar: React.FC<NavbarProps> = ({ role }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();
  
  const toggleMenu = () => setIsOpen(!isOpen);
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  let navItems: NavItem[] = [];

  // Define os itens de navegação com base na função do usuário
  if (role === 'admin') {
    navItems = [
      { label: 'Dashboard', href: '/admin' },
      { label: 'Eventos', href: '/admin/eventos' },
      { label: 'Operadores', href: '/admin/operadores' },
    ];
  } else if (role === 'operador') {
    navItems = [
      { label: 'Dashboard', href: '/operador' },
      { label: 'Recepcionistas', href: '/operador/recepcionistas' },
      { label: 'Participantes', href: '#' }, // Este será um dropdown
    ];
  } else if (role === 'recepcionista') {
    navItems = [
      { label: 'Dashboard', href: '/recepcionista' },
    ];
  }

  return (
    <nav className="bg-primary shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-white text-xl font-bold">
                IN-TRADA
              </Link>
            </div>
            
            {/* Menu para desktop */}
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="text-white hover:bg-primary-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="hidden md:flex md:items-center">
            <div className="flex items-center">
              <span className="text-white mr-4">
                {userData?.displayName || currentUser?.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center text-white hover:bg-primary-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                <LogOut className="w-5 h-5 mr-1" />
                Sair
              </button>
            </div>
          </div>
          
          {/* Botão de menu móvel */}
          <div className="flex items-center md:hidden">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              aria-expanded="false"
            >
              <span className="sr-only">Abrir menu principal</span>
              {isOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Menu móvel */}
      {isOpen && (
        <div className="md:hidden bg-primary-800">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="text-white hover:bg-primary-600 block px-3 py-2 rounded-md text-base font-medium"
                onClick={toggleMenu}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-primary-600">
            <div className="flex items-center px-5">
              <div className="ml-3">
                <div className="text-base font-medium text-white">
                  {userData?.displayName || currentUser?.email}
                </div>
                <div className="text-sm font-medium text-primary-300">
                  {currentUser?.email}
                </div>
              </div>
            </div>
            <div className="mt-3 px-2 space-y-1">
              <button
                onClick={() => {
                  handleLogout();
                  toggleMenu();
                }}
                className="w-full text-left text-white hover:bg-primary-600 block px-3 py-2 rounded-md text-base font-medium"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;