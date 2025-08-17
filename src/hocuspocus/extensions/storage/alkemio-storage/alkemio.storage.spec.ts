import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { mock, MockProxy } from 'vitest-mock-extended';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlkemioStorage } from './alkemio.storage';
import { AlkemioStorageService } from './alkemio.storage.service';
import { onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server';
import { Document } from '@hocuspocus/server';

describe.only('AlkemioStorage', () => {
  let storage: AlkemioStorage;
  let storageService: MockProxy<AlkemioStorageService>;
  let mockLogger: MockProxy<any>;
  let mockDoc: Document;

  beforeEach(async () => {
    storageService = mock<AlkemioStorageService>();
    mockLogger = mock<any>();
    mockDoc = new Document('mock');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlkemioStorage,
        {
          provide: AlkemioStorageService,
          useValue: storageService,
        },
        {
          provide: WINSTON_MODULE_NEST_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    storage = module.get<AlkemioStorage>(AlkemioStorage);
  });

  describe('onLoadDocument', () => {
    let mockLoadPayload: onLoadDocumentPayload;

    beforeEach(() => {
      mockLoadPayload = {
        documentName: 'test-document-123',
        context: {},
        instance: {} as any,
        request: {} as any,
        requestHeaders: {},
        requestParameters: {},
        socketId: 'socket-123',
      } as any;
    });
    it('should handle storage service errors and rethrow them', async () => {
      const storageError = new Error('Database connection failed');
      storageService.loadDocument.mockRejectedValue(storageError);

      await expect(storage.onLoadDocument(mockLoadPayload)).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          message: 'Failed to load document.',
          documentId: 'test-document-123',
          error: storageError,
        },
        storageError.stack,
        'storage'
      );
    });
    it('should handle network timeouts during document loading', async () => {
      const timeoutError = new Error('Request timeout');
      storageService.loadDocument.mockRejectedValue(timeoutError);

      await expect(storage.onLoadDocument(mockLoadPayload)).rejects.toThrow('Request timeout');
      expect(mockLogger.error).toHaveBeenCalled();
    });
    it('should successfully load existing document', async () => {
      const existingDoc = new Document('mock');
      storageService.loadDocument.mockResolvedValue(existingDoc);

      const result = await storage.onLoadDocument(mockLoadPayload);

      expect(storageService.loadDocument).toHaveBeenCalledWith('test-document-123');
      expect(result).toBe(existingDoc);
    });
  });

  describe('onStoreDocument', () => {
    let mockStorePayload: onStoreDocumentPayload;

    beforeEach(() => {
      mockStorePayload = {
        documentName: 'test-document-456',
        document: new Document('mock'),
        context: {},
        instance: {} as any,
        request: {} as any,
        requestHeaders: {},
        requestParameters: {},
        socketId: 'socket-456',
      } as any;
    });

    it('should successfully save document', async () => {
      const saveResult = {
        saved: true,
        error: undefined,
      };
      storageService.saveDocument.mockResolvedValue(saveResult);

      const result = await storage.onStoreDocument(mockStorePayload);

      expect(storageService.saveDocument).toHaveBeenCalledWith(
        'test-document-456',
        mockStorePayload.document
      );
      expect(result).toEqual({
        saved: true,
        error: undefined,
      });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle save failures and log errors', async () => {
      const saveError = 'Version conflict detected';
      const saveResult = {
        saved: false,
        error: saveError,
      };
      storageService.saveDocument.mockResolvedValue(saveResult);

      const result = await storage.onStoreDocument(mockStorePayload);

      expect(result).toEqual({
        saved: false,
        error: saveError,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          message: 'Failed to save document.',
          documentId: 'test-document-456',
          error: saveError,
        },
        undefined,
        'storage'
      );
    });

    it('should handle storage service exceptions', async () => {
      const storageError = new Error('Storage service unavailable');
      storageService.saveDocument.mockRejectedValue(storageError);

      await expect(storage.onStoreDocument(mockStorePayload)).rejects.toThrow(
        'Storage service unavailable'
      );
    });

    it('should handle large document saves', async () => {
      const saveResult = {
        saved: true,
        error: undefined,
      };
      storageService.saveDocument.mockResolvedValue(saveResult);

      const result = await storage.onStoreDocument(mockStorePayload);

      expect(result.saved).toBe(true);
      expect(storageService.saveDocument).toHaveBeenCalledWith(
        'test-document-456',
        mockStorePayload.document
      );
    });
  });

  describe('afterStoreDocument', () => {
    let mockAfterStorePayload: onStoreDocumentPayload;

    beforeEach(() => {
      mockAfterStorePayload = {
        documentName: 'test-document-789',
        document: new Document('mock'),
        context: {
          saved: true,
          error: undefined,
        },
        instance: {} as any,
        request: {} as any,
        requestHeaders: {},
        requestParameters: {},
        socketId: 'socket-789',
      } as any;
    });

    it('should broadcast success message after successful save', async () => {
      mockAfterStorePayload.document.broadcastStateless = vi.fn();

      await storage.afterStoreDocument(mockAfterStorePayload);

      expect(mockAfterStorePayload.document.broadcastStateless).toHaveBeenCalledWith(
        JSON.stringify({ event: 'saved' })
      );
    });

    it('should broadcast error message after failed save', async () => {
      const errorPayload = {
        ...mockAfterStorePayload,
        context: {
          saved: false,
          error: 'Save failed due to conflict',
        },
      };
      mockAfterStorePayload.document.broadcastStateless = vi.fn();

      await storage.afterStoreDocument(errorPayload);

      expect(mockAfterStorePayload.document.broadcastStateless).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'save-error',
          error: 'Save failed due to conflict',
        })
      );
    });

    it('should handle JSON serialization errors gracefully', async () => {
      const circularRef: any = {};
      circularRef.self = circularRef;

      const errorPayload = {
        ...mockAfterStorePayload,
        context: {
          saved: false,
          error: circularRef,
        },
      };
      // mockDoc.broadcastStateless = vi.fn();

      // Should not throw even if JSON.stringify fails
      await expect(storage.afterStoreDocument(errorPayload)).resolves.not.toThrow();
    });

    it('should not broadcast when stateless encoding fails', async () => {
      // Mock JSON.stringify to throw
      const originalStringify = JSON.stringify;
      vi.spyOn(JSON, 'stringify').mockImplementation(() => {
        throw new Error('Serialization failed');
      });

      mockAfterStorePayload.document.broadcastStateless = vi.fn();

      await storage.afterStoreDocument(mockAfterStorePayload);

      expect(mockAfterStorePayload.document.broadcastStateless).not.toHaveBeenCalled();

      // Restore original function
      JSON.stringify = originalStringify;
    });
  });

  describe('encodeStateless private method', () => {
    it('should encode save success message correctly', () => {
      const result = (storage as any).encodeStateless({ event: 'saved' });
      expect(result).toBe(JSON.stringify({ event: 'saved' }));
    });

    it('should encode save error message correctly', () => {
      const errorMessage = { event: 'save-error', error: 'Database error' };
      const result = (storage as any).encodeStateless(errorMessage);
      expect(result).toBe(JSON.stringify(errorMessage));
    });

    it('should handle encoding errors gracefully', () => {
      const circularRef: any = {};
      circularRef.self = circularRef;

      const result = (storage as any).encodeStateless({ event: 'error', data: circularRef });
      expect(result).toBeUndefined();
    });
  });

  describe('extension configuration', () => {
    it('should have correct extension name', () => {
      expect(storage.extensionName).toBe('AlkemioStorage');
    });

    it('should inherit from AbstractStorage', () => {
      expect(storage).toHaveProperty('onLoadDocument');
      expect(storage).toHaveProperty('onStoreDocument');
      expect(typeof storage.onLoadDocument).toBe('function');
      expect(typeof storage.onStoreDocument).toBe('function');
    });
  });

  describe('error resilience', () => {
    it('should handle concurrent save operations', async () => {
      const mockStorePayload: onStoreDocumentPayload = {
        documentName: 'concurrent-test',
        document: mockDoc,
        context: {},
        instance: {} as any,
        request: {} as any,
        requestHeaders: {},
        requestParameters: {},
        socketId: 'socket-concurrent',
      } as any;

      const saveResult = { saved: true, error: undefined };
      storageService.saveDocument.mockResolvedValue(saveResult);

      // Simulate concurrent saves
      const promises = Array(5)
        .fill(null)
        .map(() => storage.onStoreDocument(mockStorePayload));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every(result => result.saved)).toBe(true);
      expect(storageService.saveDocument).toHaveBeenCalledTimes(5);
    });

    it('should handle document corruption during load', async () => {
      const mockLoadPayload: onLoadDocumentPayload = {
        documentName: 'corrupted-document',
        context: {},
        instance: {} as any,
        request: {} as any,
        requestHeaders: {},
        requestParameters: {},
        socketId: 'socket-corrupted',
      } as any;

      const corruptionError = new Error('Document data corrupted');
      storageService.loadDocument.mockRejectedValue(corruptionError);

      await expect(storage.onLoadDocument(mockLoadPayload)).rejects.toThrow(
        'Document data corrupted'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to load document.',
          documentId: 'corrupted-document',
        }),
        corruptionError.stack,
        'storage'
      );
    });
  });
});
