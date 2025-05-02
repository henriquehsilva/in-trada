# IN-TRADA - Sistema de Credenciamento de Eventos

Sistema completo para credenciamento e gestão de participantes em eventos, com painéis e crachás personalizáveis via editor visual (drag and drop), leitura de QR code e impressão de etiquetas.

## Funcionalidades

- **Autenticação com múltiplos níveis de acesso**
  - Admin: gerencia eventos e operadores
  - Operador: gerencia recepcionistas e modelos de crachás
  - Recepcionista: realiza o credenciamento de participantes

- **Gestão de eventos e usuários**
  - CRUD completo de eventos e usuários
  - Campos personalizados por evento

- **Editor visual drag & drop**
  - Criação de layouts de crachás
  - Configuração de painéis de recepção
  - Interface intuitiva e componentes reutilizáveis

- **Gerenciamento de participantes**
  - Cadastro, busca e filtro
  - Check-in via QR Code
  - Impressão de credenciais

- **Relatórios e Estatísticas**
  - Visualização em tempo real
  - Exportação para CSV e Excel

## Tecnologias Utilizadas

- **Frontend:**
  - React 18
  - TypeScript
  - Tailwind CSS
  - Lucide Icons
  - react-beautiful-dnd para drag & drop
  - react-to-print para impressão

- **Backend:**
  - Firebase Authentication
  - Cloud Firestore
  - Firebase Storage
  - Firebase Hosting

- **Outras bibliotecas:**
  - date-fns
  - recharts para gráficos
  - html5-qrcode para leitura de QR Code
  - qrcode.react para geração de QR Code
  - xlsx para exportação de relatórios

## Estrutura do Projeto

```
src/
  ├── components/
  │   ├── auth/         # Componentes relacionados à autenticação
  │   ├── common/       # Componentes compartilhados 
  │   ├── editor/       # Componentes do editor drag & drop
  │   ├── layout/       # Layouts e componentes estruturais
  │   └── qrcode/       # Componentes para QR Code
  │
  ├── contexts/         # Contextos React
  │   └── AuthContext.tsx
  │
  ├── firebase/         # Configuração do Firebase
  │   └── config.ts
  │
  ├── models/           # Definições de tipos
  │   └── types.ts
  │
  ├── pages/            # Páginas da aplicação
  │   ├── admin/        # Páginas de administração
  │   ├── auth/         # Páginas de autenticação
  │   ├── operador/     # Páginas de operador
  │   └── recepcionista/ # Páginas de recepção
  │
  └── services/         # Serviços para comunicação com o Firebase
      ├── eventoService.ts
      ├── modeloService.ts
      └── participanteService.ts
```

## Como executar o projeto

1. Clone o repositório
2. Instale as dependências com `npm install`
3. Configure o Firebase:
   - Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
   - Substitua as credenciais no arquivo `src/firebase/config.ts`
4. Execute o projeto com `npm run dev`

## Deploy

Realize o deploy usando Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init
firebase deploy
```

## Licença

Este projeto está licenciado sob a licença MIT.