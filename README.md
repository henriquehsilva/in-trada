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

### Impressão automática no Chrome

O sistema chama `window.print()` automaticamente depois de montar o crachá. Para
abrir `https://intradacredenciamentos.com.br/` e imprimir diretamente na
impressora padrão, sem exibir o diálogo de impressão, execute:

```bash
npm run kiosk
```

O comando abre o domínio de produção no Chrome com `--kiosk-printing` e usa um
perfil exclusivo, salvo em `.chrome-kiosk-profile/`. Na primeira abertura, faça
login no sistema e confirme a impressora padrão nas configurações do Chrome.

Para testar o servidor local, deixe `npm run dev` aberto em outro terminal e use:

```bash
npm run kiosk:local
```

Para abrir outra URL, informe-a após `--`:

```bash
npm run kiosk -- https://outro-dominio.com
```

Feche todas as janelas desse perfil antes de reabri-lo caso altere as opções de
inicialização. A opção `--kiosk-printing` envia qualquer chamada a
`window.print()` diretamente para a impressora padrão do sistema operacional.

### Emuladores locais com dados persistentes

Inicie os emuladores em outro terminal com:

```bash
npm run emulators
```

Ao encerrar com `Ctrl+C`, os dados são exportados para `firebase-data/`. Na
próxima execução do mesmo comando, eles são importados automaticamente. Pare os
emuladores com `Ctrl+C` antes de desligar ou reiniciar a máquina para garantir
que as alterações mais recentes sejam gravadas.

## Deploy

O deploy de produção está configurado no Netlify para executar `npm run build` e
publicar a pasta `dist`. O domínio de produção é:

```text
https://intradacredenciamentos.com.br/
```

No painel do Netlify, associe esse domínio ao site e configure os registros DNS
indicados pelo próprio Netlify. O arquivo `public/_redirects` já garante que as
rotas da aplicação React funcionem ao serem acessadas diretamente.

Realize o deploy usando Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init
firebase deploy
```

## Licença

Este projeto está licenciado sob a licença MIT.
