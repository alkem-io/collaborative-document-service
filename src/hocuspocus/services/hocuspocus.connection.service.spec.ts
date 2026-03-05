import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'vitest-mock-extended';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hocuspocus } from '@hocuspocus/server';
import { HocuspocusConnectionService } from './hocuspocus.connection.service';

describe('HocuspocusConnectionService', () => {
  let service: HocuspocusConnectionService;
  let mockHocuspocus: MockProxy<Hocuspocus>;

  beforeEach(async () => {
    mockHocuspocus = mock<Hocuspocus>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [HocuspocusConnectionService],
    }).compile();

    service = module.get<HocuspocusConnectionService>(HocuspocusConnectionService);
  });

  describe('getConnections', () => {
    it('should return connections for existing document', () => {
      const documentName = 'test-document';
      const mockConnections = [
        { id: 'conn1', user: 'user1', readOnly: false },
        { id: 'conn2', user: 'user2', readOnly: true },
      ];
      const mockDocument = {
        getConnections: vi.fn().mockReturnValue(mockConnections),
      };

      mockHocuspocus.documents = new Map();
      mockHocuspocus.documents.set(documentName, mockDocument as any);

      const result = service.getConnections(mockHocuspocus, documentName);

      expect(result).toEqual(mockConnections);
      expect(mockDocument.getConnections).toHaveBeenCalled();
    });

    it('should return empty array when document does not exist', () => {
      const documentName = 'non-existent-document';
      mockHocuspocus.documents = new Map();

      const result = service.getConnections(mockHocuspocus, documentName);

      expect(result).toEqual([]);
    });

    it('should return empty array when document exists but has no connections', () => {
      const documentName = 'empty-document';
      const mockDocument = {
        getConnections: vi.fn().mockReturnValue([]),
      };

      mockHocuspocus.documents = new Map();
      mockHocuspocus.documents.set(documentName, mockDocument as any);

      const result = service.getConnections(mockHocuspocus, documentName);

      expect(result).toEqual([]);
    });
  });

  describe('getReadOnlyConnections', () => {
    it('should filter and return only read-only connections', () => {
      const documentName = 'test-document';
      const mockConnections = [
        { id: 'conn1', user: 'editor1', readOnly: false },
        { id: 'conn2', user: 'viewer1', readOnly: true },
        { id: 'conn3', user: 'editor2', readOnly: false },
        { id: 'conn4', user: 'viewer2', readOnly: true },
      ];
      const mockDocument = {
        getConnections: vi.fn().mockReturnValue(mockConnections),
      };

      mockHocuspocus.documents = new Map();
      mockHocuspocus.documents.set(documentName, mockDocument as any);

      const result = service.getReadOnlyConnections(mockHocuspocus, documentName);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'conn2', user: 'viewer1', readOnly: true });
      expect(result[1]).toEqual({ id: 'conn4', user: 'viewer2', readOnly: true });
      expect(result.every(conn => conn.readOnly)).toBe(true);
    });

    it('should return empty array when no read-only connections exist', () => {
      const documentName = 'test-document';
      const mockConnections = [
        { id: 'conn1', user: 'editor1', readOnly: false },
        { id: 'conn2', user: 'editor2', readOnly: false },
      ];
      const mockDocument = {
        getConnections: vi.fn().mockReturnValue(mockConnections),
      };

      mockHocuspocus.documents = new Map();
      mockHocuspocus.documents.set(documentName, mockDocument as any);

      const result = service.getReadOnlyConnections(mockHocuspocus, documentName);

      expect(result).toEqual([]);
    });

    it('should return empty array when document has no connections', () => {
      const documentName = 'empty-document';
      mockHocuspocus.documents = new Map();

      const result = service.getReadOnlyConnections(mockHocuspocus, documentName);

      expect(result).toEqual([]);
    });
  });

  describe('getCollaboratorConnections', () => {
    it('should filter and return only collaborator (non-read-only) connections', () => {
      const documentName = 'test-document';
      const mockConnections = [
        { id: 'conn1', user: 'editor1', readOnly: false },
        { id: 'conn2', user: 'viewer1', readOnly: true },
        { id: 'conn3', user: 'editor2', readOnly: false },
        { id: 'conn4', user: 'viewer2', readOnly: true },
      ];
      const mockDocument = {
        getConnections: vi.fn().mockReturnValue(mockConnections),
      };

      mockHocuspocus.documents = new Map();
      mockHocuspocus.documents.set(documentName, mockDocument as any);

      const result = service.getCollaboratorConnections(mockHocuspocus, documentName);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'conn1', user: 'editor1', readOnly: false });
      expect(result[1]).toEqual({ id: 'conn3', user: 'editor2', readOnly: false });
      expect(result.every(conn => !conn.readOnly)).toBe(true);
    });

    it('should return empty array when all connections are read-only', () => {
      const documentName = 'test-document';
      const mockConnections = [
        { id: 'conn1', user: 'viewer1', readOnly: true },
        { id: 'conn2', user: 'viewer2', readOnly: true },
      ];
      const mockDocument = {
        getConnections: vi.fn().mockReturnValue(mockConnections),
      };

      mockHocuspocus.documents = new Map();
      mockHocuspocus.documents.set(documentName, mockDocument as any);

      const result = service.getCollaboratorConnections(mockHocuspocus, documentName);

      expect(result).toEqual([]);
    });

    it('should return empty array when document has no connections', () => {
      const documentName = 'empty-document';
      mockHocuspocus.documents = new Map();

      const result = service.getCollaboratorConnections(mockHocuspocus, documentName);

      expect(result).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined document gracefully', () => {
      const documentName = 'test-document';
      mockHocuspocus.documents = new Map();
      mockHocuspocus.documents.set(documentName, null as any);

      expect(() => service.getConnections(mockHocuspocus, documentName)).not.toThrow();
      expect(service.getConnections(mockHocuspocus, documentName)).toEqual([]);
    });

    it('should handle document with null connections', () => {
      const documentName = 'test-document';
      const mockDocument = {
        getConnections: vi.fn().mockReturnValue(null),
      };

      mockHocuspocus.documents = new Map();
      mockHocuspocus.documents.set(documentName, mockDocument as any);

      const result = service.getConnections(mockHocuspocus, documentName);
      expect(result).toEqual([]);
    });
  });
});
