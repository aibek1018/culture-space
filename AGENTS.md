\# CULTURE SPACE — Development Guidelines



\## General Rules



\- Act as a Senior Software Engineer.

\- Follow the requirements defined in PROJECT\_SPEC.md.

\- Follow the approved architecture and DEVELOPMENT\_PLAN.md.

\- Communicate with the user in Russian.

\- Keep code, identifiers, comments, and technical documentation in English.

\- Explain important architectural decisions before implementation.

\- Do not introduce unnecessary complexity.



\## Technology Stack



\### Backend

\- NestJS

\- GraphQL Code First

\- TypeORM

\- PostgreSQL

\- Redis



\### Frontend

\- Next.js

\- React

\- TypeScript

\- Apollo Client

\- Tailwind CSS



\### Infrastructure

\- Docker

\- Docker Compose

\- Nginx

\- MinIO

\- GitHub Actions

\- GitHub Container Registry



\## Architecture



\- Use Modular Monolith architecture.

\- Use strict TypeScript.

\- Follow SOLID principles where appropriate.

\- Apply separation of concerns.

\- Keep business logic inside appropriate domain modules.

\- Use dependency injection provided by NestJS.

\- Prefer explicit and type-safe solutions.



\## Backend Rules



\- Use TypeORM. Never use Prisma.

\- Use GraphQL for business operations.

\- Do not introduce REST endpoints for business operations.

\- Use GraphQL Code First approach.

\- Use DTOs, InputTypes, ObjectTypes, Services, and Resolvers appropriately.

\- Validate all incoming data.

\- Handle errors consistently.

\- Avoid `any` and unsafe type assertions.



\## Frontend Rules



\- Use Next.js with TypeScript.

\- Use Apollo Client for GraphQL communication.

\- Keep components reusable and maintainable.

\- Separate UI components from business logic.

\- Use Tailwind CSS for styling.

\- Handle loading, error, and empty states.



\## Database Rules



\- Use PostgreSQL.

\- Use TypeORM entities and migrations.

\- Never synchronize the production database automatically.

\- Define appropriate foreign keys, unique constraints, and indexes.

\- Consider database performance when designing relationships and queries.



\## Authentication and Security



\- Use Redis-based server-side sessions.

\- Do not use JWT as the primary authentication mechanism.

\- Use HttpOnly cookies.

\- Hash passwords using Argon2.

\- Validate authorization on the backend.

\- Never expose secrets or sensitive information.



\## Code Quality



\- Enable TypeScript strict mode.

\- Avoid duplicated business logic.

\- Prefer small, focused services and modules.

\- Use meaningful names.

\- Write tests for important business logic.

\- Do not use `any` unless explicitly justified.



\## Development Workflow



\- Before implementation, inspect the existing project structure.

\- Before making architectural changes, explain the reasoning.

\- Do not silently introduce new technologies or dependencies.

\- Do not modify unrelated parts of the application.

\- Do not generate code before the architecture is approved.

\- Follow DEVELOPMENT\_PLAN.md and complete work incrementally.

