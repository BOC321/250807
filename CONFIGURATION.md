# Configuration Files

This document provides an overview of all configuration files in the project and their purposes.

## Environment Configuration

### `.env.example`
- **Purpose**: Template for environment variables
- **Usage**: Copy to `.env.local` and fill in actual values
- **Key Variables**:
  - `NEXT_PUBLIC_APP_URL`: Application URL
  - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
  - `MAILEROO_API_KEY`: Maileroo API key
  - `JWT_SECRET`: JWT secret key

## Build and Development Configuration

### `next.config.js`
- **Purpose**: Next.js framework configuration
- **Key Features**:
  - React strict mode enabled
  - SWC minification enabled
  - Security headers configuration
  - Image optimization settings
  - Experimental features enabled

### `babel.config.js`
- **Purpose**: Babel transpilation configuration
- **Key Features**:
  - Next.js preset with environment targets
  - Plugin configuration for modern JavaScript features
  - Environment-specific configurations

### `postcss.config.js`
- **Purpose**: PostCSS configuration for CSS processing
- **Key Features**:
  - Tailwind CSS plugin
  - Autoprefixer for vendor prefixes

### `tailwind.config.js`
- **Purpose**: Tailwind CSS configuration
- **Key Features**:
  - Custom color palette (primary, secondary, success, warning, error)
  - Custom font families
  - Custom animations and keyframes
  - Extended spacing and shadow utilities
  - Plugin configuration (forms, typography, aspect-ratio)

## Code Quality and Linting

### `.eslintrc.json`
- **Purpose**: ESLint configuration for code linting
- **Key Features**:
  - Next.js core web vitals rules
  - TypeScript recommended rules
  - Custom rule configurations
  - Environment settings

### `.prettierrc`
- **Purpose**: Prettier code formatting configuration
- **Key Features**:
  - Semi-colons enabled
  - Trailing commas (ES5 style)
  - Single quotes for strings
  - 100 character line width
  - 2-space indentation

### `.prettierignore`
- **Purpose**: Files to ignore for Prettier formatting
- **Key Features**:
  - Ignores dependencies and build artifacts
  - Ignores environment files
  - Ignores IDE and OS files

## TypeScript Configuration

### `jsconfig.json`
- **Purpose**: JavaScript configuration for path aliases
- **Key Features**:
  - Path aliases for clean imports (`@/components/*`)
  - Includes and excludes configuration
  - Base URL configuration

### `tsconfig.json`
- **Purpose**: TypeScript compiler configuration
- **Key Features**:
  - Modern TypeScript settings
  - Strict type checking
  - Path mapping for imports
  - Module resolution configuration

## Testing Configuration

### `jest.config.js`
- **Purpose**: Jest testing framework configuration
- **Key Features**:
  - Next.js integration
  - Test environment setup
  - Path mapping for imports
  - Coverage configuration
  - Watch plugins

### `jest.setup.js`
- **Purpose**: Jest setup file for test environment
- **Key Features**:
  - Mocks for Next.js router
  - Mocks for browser APIs
  - Mocks for storage APIs
  - Global test utilities
  - Custom matchers

## Version Control

### `.gitignore`
- **Purpose**: Git ignore patterns
- **Key Features**:
  - Ignores dependencies and build artifacts
  - Ignores environment files
  - Ignores IDE and OS files
  - Ignores logs and coverage reports

## Editor Configuration

### `.editorconfig`
- **Purpose**: Editor configuration for consistent coding style
- **Key Features**:
  - Line ending configuration (LF)
  - Character set (UTF-8)
  - Indentation settings per file type
  - Trimming whitespace rules

### `.vscode/settings.json`
- **Purpose**: VS Code workspace settings
- **Key Features**:
  - Format on save enabled
  - ESLint and Prettier integration
  - File associations and exclusions
  - TypeScript and JavaScript preferences
  - Terminal and Git settings

### `.vscode/extensions.json`
- **Purpose**: VS Code recommended extensions
- **Key Features**:
  - Prettier, ESLint, Tailwind CSS
  - TypeScript and JavaScript tools
  - Git and GitHub integration
  - Docker and remote development
  - Testing and debugging tools

### `.vscode/tasks.json`
- **Purpose**: VS Code task configuration
- **Key Features**:
  - Development server tasks
  - Build and test tasks
  - Linting and formatting tasks
  - Database and deployment tasks

### `.vscode/launch.json`
- **Purpose**: VS Code debugging configuration
- **Key Features**:
  - Chrome debugging
  - Next.js debugging
  - Test debugging
  - Server-side debugging
  - Custom script debugging

## Usage Instructions

### Setting Up Environment
1. Copy `.env.example` to `.env.local`
2. Fill in your actual environment variable values
3. Never commit `.env.local` to version control

### Running the Application
- **Development**: `npm run dev` or use VS Code task "Start Development Server"
- **Production**: `npm run build` then `npm start`
- **Testing**: `npm test` or use VS Code debugging configurations

### Code Quality
- **Linting**: `npm run lint` or use VS Code's ESLint integration
- **Formatting**: `npm run format` or use VS Code's Prettier integration
- **Type Checking**: `npm run type-check`

### Development Workflow
1. Install recommended VS Code extensions
2. Use VS Code tasks for common operations
3. Use VS Code launch configurations for debugging
4. Follow the coding style enforced by ESLint and Prettier

## Best Practices

1. **Environment Variables**: Always use `.env.local` for local development
2. **Code Quality**: Run linting and formatting before committing
3. **Testing**: Ensure all tests pass before deploying
4. **Type Safety**: Use TypeScript strict mode for better type checking
5. **Performance**: Use the optimized build configurations for production

## Troubleshooting

### Common Issues
- **Import Errors**: Check `jsconfig.json` path mappings
- **Linting Errors**: Run `npm run lint:fix` to auto-fix issues
- **Type Errors**: Run `npm run type-check` to identify TypeScript issues
- **Build Failures**: Check `next.config.js` for configuration issues

### Getting Help
- Refer to individual configuration file comments
- Check Next.js, TypeScript, and Tailwind CSS documentation
- Use VS Code's built-in help for extension and configuration issues
