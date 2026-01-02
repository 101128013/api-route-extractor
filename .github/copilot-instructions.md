# GitHub Copilot Instructions for API Route Extractor

## Project Overview

This is an AI-powered API Route Extractor application built with React, TypeScript, and Vite. The tool helps developers discover, analyze, and test API endpoints from various sources including code files, URLs, and documentation.

**Key Features:**
- AI-powered endpoint discovery using Google Gemini AI
- Smart crawling with AI Discovery mode
- Multi-input support (code, file, URL)
- Request builder with live execution
- Environment variable management
- OpenAPI and Postman export capabilities
- Request history and collections management
- Built-in authentication support
- Response validation and testing

## Technology Stack

- **Framework:** React 18.3+ with TypeScript 5.8+
- **Build Tool:** Vite 6.2+
- **Styling:** Tailwind CSS 3.4+
- **AI Integration:** Google Gemini AI (@google/genai)
- **State Management:** React hooks with local storage persistence
- **UI Components:** Custom components with react-resizable-panels
- **Deployment:** GitHub Pages

## Project Structure

```
/
├── components/          # React components (24+ files)
│   ├── requestWorkbench/ # Sub-components for request workbench
│   ├── ActivityLog.tsx
│   ├── AuthManager.tsx
│   ├── CodeInput.tsx
│   ├── CollectionManager.tsx
│   ├── EndpointCard.tsx
│   ├── EndpointChat.tsx
│   ├── EnvironmentManager.tsx
│   ├── Header.tsx
│   ├── HistoryPanel.tsx
│   ├── RequestEditor.tsx
│   ├── RequestHistory.tsx
│   ├── RequestWorkbench.tsx
│   ├── ResultsDisplay.tsx
│   ├── SettingsModal.tsx
│   ├── TestPanel.tsx
│   └── icons.tsx       # Icon components
├── services/            # Business logic and API services
│   ├── geminiService.ts        # Google Gemini AI integration
│   ├── CrawlerService.ts       # Web crawling functionality
│   ├── RequestExecutor.ts      # HTTP request execution
│   ├── VerificationService.ts  # Endpoint verification
│   ├── AuthService.ts          # Authentication management
│   ├── CollectionService.ts    # Collections and workspaces
│   ├── HistoryService.ts       # Request history
│   ├── TestService.ts          # Testing functionality
│   ├── RequestDraftService.ts  # Request drafts
│   └── ExportService.ts        # Export functionality
├── utils/               # Utility functions
│   ├── openApiGenerator.ts     # OpenAPI spec generation
│   └── curlParser.ts           # cURL command parsing
├── hooks/               # Custom React hooks
│   └── useLocalStorage.ts      # Local storage hook
├── types.ts             # TypeScript type definitions
├── App.tsx              # Main application component
├── index.tsx            # Application entry point
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
└── tailwind.config.js   # Tailwind CSS configuration
```

## Coding Conventions

### TypeScript

- Use TypeScript for all new files
- Prefer `interface` over `type` for object shapes
- Export types from `types.ts` for shared type definitions
- Use strict type checking (no implicit `any`)
- Use proper type imports: `import type { Type } from './types'`

### React Components

- Use functional components with React hooks
- Use `React.FC` type for components where appropriate
- Keep components focused and single-responsibility
- Extract complex logic into custom hooks or services
- Use proper prop typing with interfaces

### State Management

- Use `useState` for local component state
- Use `useLocalStorage` hook for persisted state
- Keep state as close to where it's used as possible
- Services manage their own state persistence

### Styling

- Use Tailwind CSS utility classes for styling
- Custom colors defined in `tailwind.config.js`:
  - `brand-bg`: #1a1a2e (background)
  - `brand-surface`: #162447 (surface)
  - `brand-primary`: #1f4068 (primary)
  - `brand-secondary`: #e43f5a (secondary/accent)
  - `brand-text`: #dcdcdc (text)
  - `brand-subtle`: #a9a9a9 (subtle text)
- Font families: Inter (sans), Fira Code (mono)

### File Organization

- Components in `/components` directory
- Business logic in `/services` directory
- Utility functions in `/utils` directory
- Custom hooks in `/hooks` directory
- Keep related files together (e.g., sub-components in subdirectories)

### API and Services

- All AI operations go through `geminiService.ts`
- Use service classes for data management (AuthService, CollectionService, etc.)
- Services handle local storage persistence
- API calls should include proper error handling

### Naming Conventions

- Components: PascalCase (e.g., `AuthManager.tsx`)
- Services: PascalCase with Service suffix (e.g., `AuthService.ts`)
- Utils: camelCase (e.g., `curlParser.ts`)
- Types/Interfaces: PascalCase (e.g., `ApiEndpoint`)
- Functions: camelCase (e.g., `extractApiEndpoints`)
- Constants: UPPER_SNAKE_CASE (e.g., `PRICING`)

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to GitHub Pages
npm run deploy
```

## Key Dependencies

- **@google/genai**: Google Gemini AI SDK for endpoint analysis
- **react-resizable-panels**: Resizable panel layout system
- **@vitejs/plugin-react**: Vite plugin for React support
- **tailwindcss**: Utility-first CSS framework
- **gh-pages**: GitHub Pages deployment

## Environment Variables

The app requires a Gemini API key, which can be set in:
- `.env.local` file as `GEMINI_API_KEY`
- Settings modal in the app (stored in localStorage)

## Special Considerations

### AI Integration

- Primary AI provider is Google Gemini (configurable)
- Cost tracking for Gemini API usage (pricing defined in geminiService.ts)
- Supports custom OpenAI-compatible endpoints

### CORS Proxy

- Vite dev server includes a built-in CORS proxy at `/proxy`
- Used for fetching URLs without CORS issues during development

### Local Storage Keys

The app uses several localStorage keys:
- `gemini-api-key`: Gemini API key
- `ai-provider`: Selected AI provider
- `openai-base-url`, `openai-model`, `openai-api-key`: OpenAI settings
- `api-extractor-history`: Request history
- Various service-specific keys for persistence

### Path Aliases

- `@/` resolves to the project root directory
- Configured in both `tsconfig.json` and `vite.config.ts`

## Testing and Quality

Currently, the project does not have automated tests. When adding new features:
- Manually test in development mode
- Verify functionality in production build
- Test API integrations with actual endpoints
- Verify localStorage persistence across sessions

## Deployment

The app is configured for GitHub Pages deployment:
- Base path: `/api-route-extractor/`
- Run `npm run deploy` to build and deploy
- Deployment uses `gh-pages` package

## Best Practices for Contributing

1. Keep changes minimal and focused
2. Maintain existing code style and patterns
3. Use TypeScript types for all new code
4. Test manually with the dev server before committing
5. Follow the existing component structure and organization
6. Add proper error handling for all API calls
7. Use the service layer for business logic, not components
8. Keep UI components presentational when possible
