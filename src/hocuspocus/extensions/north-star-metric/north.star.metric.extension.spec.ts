import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Document } from '@hocuspocus/server';
import { NorthStarMetric } from './north.star.metric.extension';
import { NorthStarMetricService } from './north.star.metric.service';
import { defaultMockerFactory } from '@test/utils';
import { UserInfo } from '@src/services/integration/types';
import { ConnectionContext } from '../connection.context';

describe('NorthStarMetric', () => {
  let extension: NorthStarMetric;
  let northStarMetricService: NorthStarMetricService;
  let configService: ConfigService;

  const mockUserInfo: UserInfo = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockUserInfo2: UserInfo = {
    id: 'user-456',
    email: 'test2@example.com',
  };

  const createMockDocument = (name: string): Document => {
    return {
      name,
    } as Document;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NorthStarMetric,
        {
          provide: ConfigService,
          useValue: {
            get: () => 1,
          },
        },
      ],
    })
      .useMocker(defaultMockerFactory)
      .compile();

    extension = module.get<NorthStarMetric>(NorthStarMetric);
    northStarMetricService = module.get<NorthStarMetricService>(NorthStarMetricService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('constructor', () => {
    it('should set extensionName to class name', () => {
      // Assert
      expect(extension.extensionName).toBe('NorthStarMetric');
    });
  });

  describe('onChange - failing paths', () => {
    it('should return early when context has no userInfo', async () => {
      // Arrange
      const mockDocument = createMockDocument('test-room');
      const payload = {
        document: mockDocument,
        context: {} as ConnectionContext,
      } as any;

      // Act
      await extension.onChange(payload);

      // Assert
      expect(payload.context.lastContributed).toBeUndefined();
    });

    it('should return early when userInfo has no id', async () => {
      // Arrange
      const mockDocument = createMockDocument('test-room');
      const payload = {
        document: mockDocument,
        context: {
          userInfo: { id: '', email: 'test@example.com' },
        } as ConnectionContext,
      } as any;

      // Act
      await extension.onChange(payload);

      // Assert
      expect(payload.context.lastContributed).toBeUndefined();
    });
  });

  describe('onChange - green paths', () => {
    it('should update lastContributed timestamp when userInfo exists', async () => {
      // Arrange
      const mockDocument = createMockDocument('test-room');
      const payload = {
        document: mockDocument,
        context: {
          userInfo: mockUserInfo,
        } as ConnectionContext,
      } as any;
      // start the timer
      await extension.afterLoadDocument(payload);

      const beforeTime = Date.now();

      // Act
      await extension.onChange(payload);

      // Assert
      expect(payload.context.lastContributed).toBeGreaterThanOrEqual(beforeTime);
      expect(payload.context.lastContributed).toBeLessThanOrEqual(Date.now());
    });

    it('should set lastContributed for multiple onChange calls', async () => {
      // Arrange
      const mockDocument = createMockDocument('test-room');
      const payload1 = {
        document: mockDocument,
        context: {
          userInfo: mockUserInfo,
        } as ConnectionContext,
      } as any;
      const payload2 = {
        document: mockDocument,
        context: {
          userInfo: mockUserInfo2,
        } as ConnectionContext,
      } as any;

      // start the timer
      await extension.afterLoadDocument({ document: mockDocument } as any);

      // Act
      await extension.onChange(payload1);
      await extension.onChange(payload2);

      // Assert
      expect(payload1.context.lastContributed).toBeDefined();
      expect(payload2.context.lastContributed).toBeDefined();
    });

    it('should handle onChange calls with the same user multiple times', async () => {
      // Arrange
      const mockDocument = createMockDocument('test-room');
      const payload = {
        document: mockDocument,
        context: {
          userInfo: mockUserInfo,
        } as ConnectionContext,
      } as any;

      // start the timer
      await extension.afterLoadDocument({ document: mockDocument } as any);

      // Act
      await extension.onChange(payload);
      const firstTimestamp = payload.context.lastContributed;

      await extension.onChange(payload);
      const secondTimestamp = payload.context.lastContributed;

      // Assert
      expect(firstTimestamp).toBeDefined();
      expect(secondTimestamp).toBeDefined();
      expect(secondTimestamp).toBeGreaterThanOrEqual(firstTimestamp!);
    });
  });

  describe('afterLoadDocument', () => {
    it('should return a promise when document is loaded', async () => {
      // Arrange
      const mockDocument = createMockDocument('test-room');
      const payload = { document: mockDocument } as any;

      // Act
      const result = extension.afterLoadDocument(payload);

      // Assert
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('beforeUnloadDocument - failing paths', () => {
    it('should handle missing tracker gracefully without throwing', async () => {
      // Arrange
      const mockDocument = createMockDocument('non-existent-room');

      // Act & Assert
      await expect(
        extension.beforeUnloadDocument({ document: mockDocument } as any)
      ).resolves.toBeUndefined();
    });
  });

  describe('beforeUnloadDocument - green paths', () => {
    it('should return a promise', async () => {
      // Arrange
      const mockDocument = createMockDocument('test-room');

      // Act
      const result = extension.beforeUnloadDocument({ document: mockDocument } as any);

      // Assert
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('integration behavior', () => {
    it('should handle onChange for different documents independently', async () => {
      // Arrange
      const mockDocument1 = createMockDocument('room-1');
      const mockDocument2 = createMockDocument('room-2');

      const changePayload1 = {
        document: mockDocument1,
        context: {
          userInfo: mockUserInfo,
        } as ConnectionContext,
      } as any;
      const changePayload2 = {
        document: mockDocument2,
        context: {
          userInfo: mockUserInfo2,
        } as ConnectionContext,
      } as any;
      // start the timer
      await extension.afterLoadDocument({ document: mockDocument1 } as any);
      await extension.afterLoadDocument({ document: mockDocument2 } as any);

      // Act
      await extension.onChange(changePayload1);
      await extension.onChange(changePayload2);

      // Assert
      expect(changePayload1.context.lastContributed).toBeDefined();
      expect(changePayload2.context.lastContributed).toBeDefined();
    });

    it('should update timestamp for each onChange call', async () => {
      // Arrange
      const mockDocument = createMockDocument('test-room');
      const payload = {
        document: mockDocument,
        context: {
          userInfo: mockUserInfo,
        } as ConnectionContext,
      } as any;
      // start the timer
      await extension.afterLoadDocument({ document: mockDocument } as any);

      // Act
      await extension.onChange(payload);
      const timestamp1 = payload.context.lastContributed;

      await new Promise((resolve) => setTimeout(resolve, 1));

      await extension.onChange(payload);
      const timestamp2 = payload.context.lastContributed;

      // Assert
      expect(timestamp1).toBeDefined();
      expect(timestamp2).toBeDefined();
      expect(timestamp2).toBeGreaterThanOrEqual(timestamp1!);
    });
  });
});
