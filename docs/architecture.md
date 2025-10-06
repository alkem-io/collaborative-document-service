# Collaborative Document Service - Architecture Documentation

## Table of Contents
- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [High-Level Architecture](#high-level-architecture)
- [Core Components](#core-components)
- [Extension System](#extension-system)
- [Integration Layer](#integration-layer)
- [Communication Flows](#communication-flows)
- [Data Flow](#data-flow)
- [Configuration](#configuration)
- [Deployment](#deployment)

## Overview

The Collaborative Document Service (CDS) is a real-time collaborative editing microservice built on NestJS and Hocuspocus. It enables multiple users to simultaneously edit documents with instant synchronization, awareness/presencing features, and robust conflict resolution using Conflict-free Replicated Data Types (CRDTs) via Yjs.

The service acts as a WebSocket-based collaboration backend that integrates with the Alkemio platform for authentication, authorization, and persistent storage.

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 22+ with TypeScript
- **Framework**: NestJS 11 (using Fastify adapter)
- **Collaboration Engine**: Hocuspocus Server 3.x
- **CRDT Library**: Yjs (Y.js) for conflict-free document synchronization
- **Message Broker**: RabbitMQ (via AMQP)
- **WebSocket**: Native WebSocket support via Hocuspocus
- **Package Manager**: pnpm

### Supporting Libraries
- **Logging**: Winston (via nest-winston)
- **Configuration**: @nestjs/config with YAML support
- **Microservices**: @nestjs/microservices for RabbitMQ integration
- **Testing**: Vitest with coverage support

## High-Level Architecture

```
┌─────────────┐
│   Client    │
│ Application │
└──────┬──────┘
       │ WebSocket
       │ (+ HTTP Headers/Cookies)
       ↓
┌─────────────────────┐
│   Traefik Proxy     │
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│   Ory Oathkeeper    │ ← Identity & Access Management
│  (Authorization)    │
└──────┬──────────────┘
       │
       ↓
┌──────────────────────────────────────────────┐
│  Collaborative Document Service (CDS)        │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │      Hocuspocus Server (WebSocket)     │  │
│  │                                        │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │   Extension Pipeline             │  │  │
│  │  │                                  │  │  │
│  │  │  1. Authentication Extension     │  │  │
│  │  │  2. Authorization Extension      │  │  │
│  │  │  3. Storage Extension            │  │  │
│  │  │  4. North Star Metric Extension  │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │     Integration Service (RabbitMQ)     │  │
│  └────────────────────────────────────────┘  │
└────────────┬─────────────────────────────────┘
             │ RabbitMQ
             │ (AMQP Protocol)
             ↓
┌──────────────────────────┐
│  Collaboration Server    │
│  (Main Alkemio Backend)  │
│                          │
│  - User Authentication   │
│  - Document Authorization│
│  - Document Storage      │
│  - Metrics Collection    │
└──────────────────────────┘
```

## Core Components

### 1. Application Module (`AppModule`)

The root module that orchestrates the entire application:
- **Configuration Management**: Global configuration using `ConfigModule` with YAML support
- **Logging**: Winston logger configuration for structured logging
- **Hocuspocus Module**: WebSocket server for real-time collaboration
- **Exception Handling**: Global unhandled exception filter

### 2. Hocuspocus Server (`HocuspocusServer`)

The heart of the collaboration engine:
- **Lifecycle Management**: Implements `OnModuleInit` and `OnModuleDestroy` for proper startup/shutdown
- **WebSocket Server**: Listens on configured WebSocket port (default: 4004)
- **Extension System**: Manages and prioritizes extension execution order
- **Server Instance Management**: Provides access to the Hocuspocus server and instance

**Key Methods**:
```typescript
- getServer(): Server - Returns the Hocuspocus Server instance
- getInstance(): Hocuspocus - Returns the underlying Hocuspocus instance
```

### 3. Hocuspocus Connection Service (`HocuspocusConnectionService`)

A dedicated service for managing and querying WebSocket connections:
- **Connection Tracking**: Provides utilities to query connections for a document
- **Connection Filtering**: Distinguishes between read-only and collaborator connections
- **Stateless Design**: Pure query methods without side effects

**Key Methods**:
```typescript
- getConnections(instance, documentName): Get all connections to a document
- getReadOnlyConnections(instance, documentName): Get read-only connections
- getCollaboratorConnections(instance, documentName): Get editing connections
```

### 4. Main Application (`main.ts`)

Bootstrap logic:
- Creates NestJS application with Fastify adapter
- Configures Winston logger
- Starts REST API on configured port (default: 4005)
- Environment-aware logging (production vs. development)

## Extension System

The service uses a **prioritized extension pipeline** where each extension handles specific concerns. Extensions are executed in order of priority (highest to lowest).

### Extension Execution Order

1. **Authentication Extension** (Highest Priority)
2. **Authorization Extension**
3. **Storage Extension**
4. **North Star Metric Extension** (Lowest Priority)

### 1. Authentication Extension (`AlkemioAuthenticator`)

**Purpose**: Validates user identity through multiple authentication methods.

**Supported Authentication Methods**:
- Kratos session cookies
- JWT token in `Authorization` header
- JWT token in Hocuspocus-specific `token` field

**Lifecycle Hooks**:
- `onConnect`: First authentication attempt using HTTP headers
- `onAuthenticate`: Secondary authentication using Hocuspocus token field
- `connected`: Log successful authentication

**Flow**:
1. Extract authentication credentials (cookie or JWT)
2. Call Integration Service to verify user identity
3. Store user info in connection context
4. If authentication fails, throw `AuthenticationException`

### 2. Authorization Extension (`AlkemioAuthorizer`)

**Purpose**: Determines user's access level to specific documents.

**Access Levels**:
- **Read Access**: Can view the document
- **Read-Only Access**: Can view but not edit (with reason code)
- **Collaborator Access**: Can edit the document

**Features**:
- **Multi-user Support**: Enforces maximum collaborator limits
- **Dynamic Access Control**: Checks current collaborator count
- **Real-time Feedback**: Sends read-only state to clients via stateless messages

**Lifecycle Hooks**:
- `onConnect`: Authorize during connection phase
- `onAuthenticate`: Authorize during authentication phase
- `connected`: Send access level to client, log connection stats

**Authorization Result**:
```typescript
{
  canRead: boolean;
  readOnly: boolean;
  readOnlyCode: ReadOnlyCode; // Reason for read-only status
  maxCollaborators: number;
  isMultiUser: boolean;
}
```

### 3. Storage Extension (`AlkemioStorage`)

**Purpose**: Manages document persistence (loading and saving).

**Lifecycle Hooks**:
- `onLoadDocument`: Load document from Collaboration Server when first client connects
- `onStoreDocument`: Save document after changes (debounced)
- `afterStoreDocument`: Notify clients of save success/failure

**Features**:
- **Debounced Saving**: Reduces save frequency (configurable)
- **Error Handling**: Graceful error handling with client notifications
- **Stateless Messages**: Broadcasts save events (`saved` or `save-error`)

**Document Format**: Uses Yjs `Doc` format for CRDT-based synchronization.

### 4. North Star Metric Extension (`NorthStarMetric`)

**Purpose**: Tracks user contributions for analytics and engagement metrics.

**Features**:
- **Contribution Tracking**: Monitors which users actively edit documents
- **Time-Windowed**: Aggregates contributions over configurable windows (default: 10 minutes)
- **Per-Room Tracking**: Maintains separate contribution state per document
- **Automatic Cleanup**: Cleans up trackers when documents are unloaded

**Lifecycle Hooks**:
- `afterLoadDocument`: Start contribution tracker for the room
- `onChange`: Record user contribution
- `beforeUnloadDocument`: Stop tracker and cleanup

**Implementation**:
- Uses `Map<documentId, ContributionTrackerRoomData>` to track contributions
- Periodic interval timer sends aggregated metrics to Collaboration Server
- AbortController for proper cleanup

## Integration Layer

### Integration Service (`IntegrationService`)

**Purpose**: Manages communication with the Collaboration Server via RabbitMQ.

**Key Responsibilities**:
1. **User Authentication**: Validate user identity (`who` message pattern)
2. **Document Authorization**: Check document access permissions (`info` message pattern)
3. **Document Persistence**: Fetch and save documents (`fetch`, `save` message patterns)
4. **Metrics Reporting**: Send contribution metrics
5. **Health Checks**: Monitor queue connectivity

**Configuration**:
- Queue name: `collaboration-document-service`
- Response timeout: 5000ms (configurable)
- Max retries: 3 (configurable)
- Protocol: AMQP (RabbitMQ)

**Message Patterns**:
- **Request-Response**: Synchronous communication (e.g., `who`, `info`, `fetch`)
- **Event-based**: Asynchronous notifications (e.g., contribution metrics)

**Error Handling**:
- Retry mechanism with configurable attempts
- Timeout protection
- Connection health monitoring
- Graceful degradation

### Sender Service (`SenderService`)

**Purpose**: Low-level message sending with retry and timeout logic.

**Features**:
- Automatic retry on failure
- Configurable timeouts
- Error categorization (timeout vs. connection errors)

## Communication Flows

### 1. Initial Connection Flow (Handshake)

```
Client                    CDS                     Collaboration Server
  │                        │                              │
  │──WebSocket Connect────▶│                              │
  │  (Cookies/Headers)     │                              │
  │                        │                              │
  │                        │──RabbitMQ: who()───────────▶│
  │                        │  (Authentication)            │
  │                        │◀────User Info────────────────│
  │                        │                              │
  │                        │──RabbitMQ: info()──────────▶│
  │                        │  (Authorization)             │
  │                        │◀────Access Permissions───────│
  │                        │                              │
  │                        │──RabbitMQ: fetch()─────────▶│
  │                        │  (Load Document)             │
  │                        │◀────Document Content─────────│
  │                        │                              │
  │◀──authenticated────────│                              │
  │◀──stateless: readOnly──│                              │
  │◀──document state───────│                              │
  │                        │                              │
```

**Steps**:
1. Client initiates WebSocket connection with authentication credentials
2. CDS authenticates user via Collaboration Server
3. CDS authorizes user access to requested document
4. CDS loads document from Collaboration Server
5. CDS sends document state and access level to client
6. Client receives `authenticated` and `read-only-state` messages

### 2. Document Edit Flow

```
Client A        Client B           CDS              Collaboration Server
  │                │                │                        │
  │──edit──────────────────────────▶│                        │
  │                │◀──sync────────│                        │
  │                │                │                        │
  │                │──edit────────▶│                        │
  │◀──sync─────────────────────────│                        │
  │                │                │                        │
  │                │                │ (debounce timer)       │
  │                │                │                        │
  │                │                │──RabbitMQ: save()────▶│
  │                │                │◀──saved───────────────│
  │◀──stateless: saved─────────────│                        │
  │                │◀──stateless: saved                     │
  │                │                │                        │
```

**Steps**:
1. Client makes edit (generates Yjs update)
2. CDS broadcasts update to all connected clients
3. After debounce period, CDS saves to Collaboration Server
4. CDS broadcasts save confirmation to all clients

### 3. Contribution Tracking Flow

```
Client              CDS                    Collaboration Server
  │                  │                              │
  │──onChange──────▶│                              │
  │  (edit)          │ (track in memory)            │
  │                  │                              │
  │                  │ ... window timeout ...       │
  │                  │                              │
  │                  │──RabbitMQ: memoContrib()───▶│
  │                  │  (aggregated metrics)        │
  │                  │                              │
```

**Steps**:
1. User makes changes (triggers `onChange` hook)
2. CDS records user in contribution tracker
3. After contribution window (10 minutes), CDS sends aggregated metrics
4. Tracker resets for next window

## Data Flow

### Connection Context

Each WebSocket connection maintains a context object that accumulates data through the extension pipeline:

```typescript
ConnectionContext {
  // From Authentication Extension
  isAuthenticated?: boolean;
  authenticatedBy?: 'onConnect' | 'onAuthenticate';
  userInfo?: UserInfo;
  
  // From Authorization Extension
  readOnly?: boolean;
  readOnlyCode?: ReadOnlyCode;
  maxCollaborators?: number;
  isMultiUser?: boolean;
  authorizedBy?: 'onConnect' | 'onAuthenticate';
  
  // From North Star Metric Extension
  lastContributed?: number; // timestamp
}
```

### Stateless Messaging

The service uses **stateless messages** to send one-way notifications to clients without affecting the document state:

**Message Types**:
1. **Read-Only State** (`read-only-state`):
   ```typescript
   {
     event: 'read-only-state',
     readOnly: boolean,
     readOnlyCode: ReadOnlyCode
   }
   ```

2. **Save Success** (`saved`):
   ```typescript
   {
     event: 'saved'
   }
   ```

3. **Save Error** (`save-error`):
   ```typescript
   {
     event: 'save-error',
     error: string
   }
   ```

### Yjs Document Structure

Documents are managed using **Yjs** (CRDT library):
- **Y.Doc**: Root document object
- **Shared Types**: Y.Text, Y.Map, Y.Array, Y.XmlFragment
- **Updates**: Binary format for synchronization
- **Awareness**: Separate protocol for cursor positions and user presence

## Configuration

### Configuration System

The service uses a **YAML-based configuration** with environment variable substitution:

**Format**: `${ENV_VAR_NAME}:default_value`

### Key Configuration Sections

#### RabbitMQ Connection
```yaml
rabbitmq:
  connection:
    host: localhost
    port: 5672
    user: alkemio-admin
    password: alkemio!
    heartbeat: 30
```

#### Application Settings
```yaml
settings:
  application:
    ws_port: 4004           # WebSocket port
    rest_port: 4005         # REST API port (health checks)
    queue: collaboration-document-service
    queue_response_timeout: 5000  # milliseconds
    queue_request_retries: 3
```

#### Collaboration Settings
```yaml
settings:
  collaboration:
    contribution_window: 600  # seconds (10 minutes)
```

#### Logging
```yaml
monitoring:
  logging:
    enabled: true
    level: verbose  # log|error|warn|debug|verbose
    json: false     # true for JSON format
```

## Deployment

### Container Deployment

The service is containerized using Docker:
- **Base Image**: Node.js 22+
- **Build**: Multi-stage build with production dependencies only
- **Exposed Ports**: 4004 (WebSocket), 4005 (REST)

### Kubernetes Deployment

Example deployment manifest: `manifests/collaborative-document-service-deployment-dev.yaml`

**Key Considerations**:
- **Horizontal Scaling**: Limited by WebSocket stickiness requirements
- **Load Balancing**: Requires sticky sessions for WebSocket connections
- **Health Checks**: REST endpoint on port 4005
- **Resource Limits**: Memory-intensive due to in-memory document storage

### Environment Variables

Required environment variables:
- `RABBITMQ_HOST`: RabbitMQ server hostname
- `RABBITMQ_PORT`: RabbitMQ AMQP port
- `RABBITMQ_USER`: RabbitMQ username
- `RABBITMQ_PASSWORD`: RabbitMQ password
- `WS_PORT`: WebSocket server port
- `REST_PORT`: REST API port
- `COMMUNICATION_QUEUE`: Queue name for collaboration server
- `NODE_ENV`: Environment (production/development)

### Monitoring

**Logging Contexts**:
- `AUTHENTICATION`: User authentication events
- `AUTHORIZATION`: Access control decisions
- `STORAGE`: Document load/save operations
- `INTEGRATION`: RabbitMQ communication
- `NORTH_STAR_METRIC`: Contribution tracking
- `UNHANDLED_EXCEPTION`: Global error handler

**Log Levels**:
- `error`: Critical failures
- `warn`: Recoverable issues
- `log`: Important state changes
- `verbose`: Detailed operation logs
- `debug`: Development debugging

### Security Considerations

1. **Authentication**:
    - Multi-method authentication (cookie, JWT)
    - Session validation via Collaboration Server
    - No local authentication storage

2. **Authorization**:
    - Per-document access control
    - Dynamic permission evaluation
    - Collaborator limits enforcement

3. **Network Security**:
    - WebSocket over TLS (wss://) in production
    - Reverse proxy (Traefik) for SSL termination
    - Ory Oathkeeper for identity management

4. **Data Protection**:
    - No persistent local storage
    - Document encryption in transit
    - Secure RabbitMQ communication

### Performance Optimization

1. **Debounced Saves**: Reduces database writes
2. **In-Memory Documents**: Fast access, no disk I/O
3. **Binary Protocol**: Yjs uses efficient binary updates
4. **Connection Pooling**: RabbitMQ connection reuse
5. **Fastify**: High-performance HTTP server

### Scalability Limitations

⚠️ **Important Constraints**:
- **Stateful Service**: Documents stored in memory
- **Sticky Sessions Required**: WebSocket connections must route to same instance
- **Vertical Scaling Preferred**: Limited horizontal scaling due to stickiness
- **Memory-Bound**: Memory usage grows with active documents

**Recommended Scaling Strategy**:
- Use session affinity (sticky sessions) at load balancer
- Scale vertically for more active documents
- Implement document sharding if horizontal scaling is needed
- Monitor memory usage per instance

## Extension Points

### Adding New Extensions

To add a new Hocuspocus extension:

1. Create extension class implementing `Extension` interface
2. Define required hooks (e.g., `onConnect`, `onChange`, `onStoreDocument`)
3. Register in `HocuspocusModule`
4. Add to extension array in `HocuspocusServer` constructor
5. Extensions are auto-prioritized by array order

### Custom Stateless Messages

To add new stateless message types:

1. Define message type in `stateless-messaging/`
2. Add to `StatelessMessage` union type
3. Send using `connection.sendStateless()` or `document.broadcastStateless()`

### Integration Service Extensions

To add new RabbitMQ message patterns:

1. Define input/output types in `services/integration/inputs` and `outputs`
2. Add message pattern to `IntegrationMessagePattern` or `IntegrationEventPattern`
3. Implement method in `IntegrationService`
4. Use `senderService.sendWithResponse()` for request-response patterns

## Testing

### Testing Strategy

- **Unit Tests**: Vitest with mocking support
- **Test Location**: Co-located with source files (`.spec.ts`)
- **Coverage**: Istanbul/v8 coverage reporting

### Test Patterns

```typescript
// Arrange
const mockData = createMockData();

// Act
const result = await service.method(mockData);

// Assert
expect(result).toBe(expectedValue);
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/hocuspocus/hocuspocus.server.spec.ts

# Run with UI
pnpm test:ui

# Run with coverage
pnpm test:coverage
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failures**:
    - Check authentication credentials
    - Verify Oathkeeper configuration
    - Ensure WebSocket port is accessible

2. **RabbitMQ Connection Issues**:
    - Verify RabbitMQ is running
    - Check connection credentials
    - Review queue configuration

3. **Document Save Failures**:
    - Check Collaboration Server availability
    - Review timeout settings
    - Verify document permissions

4. **Memory Issues**:
    - Monitor active document count
    - Check for document leak (unloaded documents)
    - Review connection cleanup

---

**Last Updated**: October 2025  
**Version**: 0.1.0  
**Maintainer**: Alkemio Foundation

