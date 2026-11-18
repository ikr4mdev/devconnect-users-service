# DevConnect Users Service

The Users Service is a NestJS microservice responsible for managing user profiles in the DevConnect platform.

It communicates synchronously through gRPC and asynchronously through RabbitMQ.

## Responsibilities

- Retrieve user profiles by user ID through gRPC.
- Consume `user.registered` events published by the Auth Service.
- Create user profiles in PostgreSQL when new users register.
- Handle duplicate event deliveries safely using Prisma upsert.

## Architecture

The service integrates with:

- **Auth Service:** Publishes user registration events through RabbitMQ.
- **API Gateway:** Can retrieve user profiles through gRPC.
- **PostgreSQL:** Stores user profile information.
- **RabbitMQ:** Delivers asynchronous user registration events.

### Communication

**gRPC**

- Service: `UsersService`
- Method: `GetProfileByUserId`
- Package: `users.v1`
- Default address: `0.0.0.0:5002`
- Protocol definition: `users/v1/users.proto` from the shared contracts package.

**RabbitMQ**

- Exchange: Configured through `RABBITMQ_EXCHANGE`
- Exchange type: `topic`
- Queue: `devconnect.users.user-registered`
- Routing key: `user.registered`
- Queue durability: Enabled
- Message acknowledgement: Manual
- Prefetch: `1`

The Auth Service publishes persistent JSON messages using an outbox pattern. The Users Service validates incoming messages and acknowledges successful processing.

## Technology Stack

- Node.js
- NestJS
- TypeScript
- gRPC
- RabbitMQ
- PostgreSQL
- Prisma ORM
- Jest
- Oxlint
- Prettier

## Prerequisites

Install the following before running the service:

- Node.js
- npm
- PostgreSQL
- RabbitMQ

You also need access to the shared DevConnect contracts package.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ikr4mdev/devconnect-users-service.git
cd devconnect-users-service
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```dotenv
# PostgreSQL
DATABASE_URL=

# RabbitMQ
RABBITMQ_URL=
RABBITMQ_EXCHANGE=

# gRPC
GRPC_URL=0.0.0.0:5002
```

Configure the database connection string, RabbitMQ connection URL, and exchange name.

The gRPC address defaults to `0.0.0.0:5002` if `GRPC_URL` is not provided.

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Apply database migrations

For local development:

```bash
npx prisma migrate dev
```

For production or staging:

```bash
npx prisma migrate deploy
```

Check migration status:

```bash
npx prisma migrate status
```

### 6. Start the service

Development:

```bash
npm run start:dev
```

Production:

```bash
npm run build
npm run start:prod
```

## Database

The service uses PostgreSQL through Prisma ORM.

### UserProfile model

| Field | Description |
|---|---|
| `id` | Unique profile identifier (UUID) |
| `userId` | Auth Service user identifier (unique UUID) |
| `displayName` | User's display name |
| `bio` | Optional profile biography |
| `avatarUrl` | Optional profile image URL |
| `createdAt` | Profile creation timestamp |
| `updatedAt` | Last update timestamp |

The `userId` field is unique, ensuring that each user has at most one profile.

The Users Service maintains its own database and does not directly access the Auth Service database.

## Testing

Run unit tests:

```bash
npm test -- --runInBand
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage:

```bash
npm run test:cov
```

Run e2e tests:

```bash
npm run test:e2e
```

The e2e test configuration is present, but e2e test cases have not yet been implemented.

## Code Quality

Run Oxlint:

```bash
npm run lint
```

Format source and test files:

```bash
npm run format
```

Build the application:

```bash
npm run build
```

## Project Structure

```text
src/
├── core/
│   └── utils/
├── infrastructure/
│   ├── database/
│   └── rabbitmq/
├── modules/
│   └── profiles/
├── app.module.ts
└── main.ts

prisma/
├── migrations/
└── schema.prisma

test/
└── jest-e2e.json
```

## Shared Contracts

The service uses:

`@ikr4mdev/devconnect-contracts`

This package provides shared protobuf definitions and event-related contracts used for communication between DevConnect microservices.

## License

UNLICENSED — Private project.
