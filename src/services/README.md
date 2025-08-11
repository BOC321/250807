# Services Organization

## Overview
This directory contains all service-related code organized into logical subdirectories for better maintainability and scalability.

## Directory Structure

```
services/
├── api/                    # API service classes
│   ├── baseService.ts     # Base API service with common functionality
│   └── surveyService.ts   # Survey-specific API service
├── external/              # External service integrations
│   ├── emailService.ts    # Email service (Maileroo integration)
│   └── pdfService.ts      # PDF generation service
├── utils/                 # Service utilities (placeholder)
├── types.ts               # Service-specific type definitions
├── index.ts               # Main service exports and configurations
└── README.md              # This file
```

## Service Architecture

### API Services (`api/`)
- **BaseService**: Provides common HTTP functionality, error handling, authentication, and retry logic
- **SurveyService**: Extends BaseService for survey-specific operations

### External Services (`external/`)
- **EmailService**: Base email service class
- **MailerooService**: Maileroo-specific email implementation
- **PDFService**: PDF generation and handling

### Types (`types.ts`)
- Comprehensive type definitions for all services
- Error classes and interfaces
- Request/response type definitions

### Main Exports (`index.ts`)
- Centralized exports for all services
- Default configurations
- Factory functions for service creation

## Usage Examples

### Using Survey Service
```typescript
import { createSurveyService } from '@/services';

const surveyService = createSurveyService();
const survey = await surveyService.getSurvey('survey-id');
```

### Using Email Service
```typescript
import { createMailerooService } from '@/services';

const emailService = await createMailerooService('your-api-key');
await emailService.sendSurveyCompletionEmail({
  to: 'user@example.com',
  surveyTitle: 'Customer Satisfaction Survey',
  resultLink: 'https://example.com/results/123'
});
```

### Using PDF Service
```typescript
import { createPDFService } from '@/services';

const pdfService = createPDFService();
const pdfData = await pdfService.generateSurveyReport(surveyData);
```

## Configuration

Services can be configured through:
- Environment variables
- Configuration objects passed to factory functions
- Default configurations in `index.ts`

## Error Handling

All services use standardized error classes:
- `ServiceError`: Base error class
- `ValidationError`: Validation errors
- `AuthenticationError`: Authentication failures
- `AuthorizationError`: Authorization failures
- `NotFoundError`: Resource not found
- `ConflictError`: Resource conflicts

## Dependencies

- `axios`: HTTP client for API services
- `@supabase/supabase-js`: Database client
- `nodemailer`: Email functionality
- `pdfkit`: PDF generation

## Best Practices

1. **Use factory functions**: Create services using the provided factory functions
2. **Handle errors**: Always catch and handle service errors appropriately
3. **Configure properly**: Set up environment variables for service configurations
4. **Type safety**: Leverage the provided TypeScript types for better development experience

## Migration Notes

This service organization replaces the previous flat service structure. All existing service functionality has been preserved and enhanced with better error handling, type safety, and organization.
