import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { mock, MockProxy } from 'vitest-mock-extended';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { UtilService } from './util.service';
import { IntegrationService } from '../integration';
import { NotProvidedException } from '@common/exceptions';
import { LogContext } from '@common/enums';
import { FetchException } from './fetch.exception';
import { UserInfo } from '../integration/types';
import { FetchInputData, InfoInputData, SaveInputData, WhoInputData } from '../integration/inputs';
import { InfoOutputData, FetchOutputData, FetchContentData, FetchErrorData, FetchErrorCodes, SaveOutputData, SaveContentData } from '../integration/outputs';
import * as transformModule from './transform';

// Mock the transform module
vi.mock('./transform', () => ({
  binaryStateV2ToYjsDoc: vi.fn(),
  yjsDocToBinaryStateV2: vi.fn(),
}));

describe('UtilService', () => {
  let service: UtilService;
  let mockIntegrationService: MockProxy<IntegrationService>;
  let mockLogger: any;

  beforeEach(async () => {
    mockIntegrationService = mock<IntegrationService>();
    mockLogger = {
      error: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UtilService,
        {
          provide: IntegrationService,
          useValue: mockIntegrationService,
        },
        {
          provide: WINSTON_MODULE_NEST_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<UtilService>(UtilService);

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('getUserInfo', () => {
    const mockUserInfo: UserInfo = {
      id: 'test-user-id',
      email: 'test@example.com',
    };

    describe('failing paths', () => {
      it('should throw NotProvidedException when neither cookie nor authorization is provided', () => {
        // Arrange
        const opts = {};

        // Act & Assert
        expect(() => service.getUserInfo(opts)).toThrow(NotProvidedException);
      });

      it('should throw NotProvidedException when both cookie and authorization are undefined', () => {
        // Arrange
        const opts = { cookie: undefined, authorization: undefined };

        // Act & Assert
        expect(() => service.getUserInfo(opts)).toThrow(NotProvidedException);
      });

      it('should throw NotProvidedException when both cookie and authorization are empty strings', () => {
        // Arrange
        const opts = { cookie: '', authorization: '' };

        // Act & Assert
        expect(() => service.getUserInfo(opts)).toThrow(NotProvidedException);
      });
    });

    describe('green paths', () => {
      it('should call integrationService.who with authorization when authorization is provided', async () => {
        // Arrange
        const opts = { authorization: 'Bearer token123' };
        mockIntegrationService.who.mockResolvedValue(mockUserInfo);

        // Act
        const result = await service.getUserInfo(opts);

        // Assert
        expect(mockIntegrationService.who).toHaveBeenCalledWith(
          new WhoInputData({ authorization: 'Bearer token123' })
        );
        expect(result).toEqual(mockUserInfo);
      });

      it('should call integrationService.who with cookie when only cookie is provided', async () => {
        // Arrange
        const opts = { cookie: 'session=abc123' };
        mockIntegrationService.who.mockResolvedValue(mockUserInfo);

        // Act
        const result = await service.getUserInfo(opts);

        // Assert
        expect(mockIntegrationService.who).toHaveBeenCalledWith(
          new WhoInputData({ cookie: 'session=abc123' })
        );
        expect(result).toEqual(mockUserInfo);
      });

      it('should prioritize authorization over cookie when both are provided', async () => {
        // Arrange
        const opts = {
          cookie: 'session=abc123',
          authorization: 'Bearer token123'
        };
        mockIntegrationService.who.mockResolvedValue(mockUserInfo);

        // Act
        const result = await service.getUserInfo(opts);

        // Assert
        expect(mockIntegrationService.who).toHaveBeenCalledWith(
          new WhoInputData({ authorization: 'Bearer token123' })
        );
        expect(result).toEqual(mockUserInfo);
      });

      it('should return undefined when integrationService.who returns undefined', async () => {
        // Arrange
        const opts = { authorization: 'Bearer token123' };
        mockIntegrationService.who.mockResolvedValue(undefined);

        // Act
        const result = await service.getUserInfo(opts);

        // Assert
        expect(result).toBeUndefined();
      });
    });
  });

  describe('getUserAccessToMemo', () => {
    const userId = 'test-user-id';
    const memoId = 'test-memo-id';

    describe('failing paths', () => {
      it('should return default InfoOutputData when integrationService.info throws an error', async () => {
        // Arrange
        const error = new Error('Integration service error')
        mockIntegrationService.info.mockRejectedValue(error);

        // Act
        const result = await service.getUserAccessToMemo(userId, memoId);

        // Assert
        expect(mockIntegrationService.info).toHaveBeenCalledWith(
          new InfoInputData(userId, memoId)
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          {
            message: 'Received error while getting user access to Memo',
            userId,
            memoId,
            error,
          },
          error.stack,
          LogContext.UTIL
        );
        expect(result).toEqual(new InfoOutputData(false, false, false, 0));
      });

      it('should handle error without stack property', async () => {
        // Arrange
        const error = new Error('Error without stack');
        mockIntegrationService.info.mockRejectedValue(error);

        // Act
        const result = await service.getUserAccessToMemo(userId, memoId);

        // Assert
        expect(mockLogger.error).toHaveBeenCalledWith(
          {
            message: 'Received error while getting user access to Memo',
            userId,
            memoId,
            error,
          },
          error.stack,
          LogContext.UTIL
        );
        expect(result).toEqual(new InfoOutputData(false, false, false, 0));
      });
    });

    describe('green paths', () => {
      it('should return InfoOutputData when integrationService.info succeeds', async () => {
        // Arrange
        const expectedResult = new InfoOutputData(true, true, false, 1);
        mockIntegrationService.info.mockResolvedValue(expectedResult);

        // Act
        const result = await service.getUserAccessToMemo(userId, memoId);

        // Assert
        expect(mockIntegrationService.info).toHaveBeenCalledWith(
          new InfoInputData(userId, memoId)
        );
        expect(result).toEqual(expectedResult);
      });
    });
  });

  describe('save', () => {
    describe('green paths', () => {
      it('should convert Y.Doc to binary state and call integrationService.save', async () => {
        // Arrange
        const documentId = 'test-doc-id';
        const mockDoc = new Y.Doc();
        const mockBinaryState = new Uint8Array([1, 2, 3, 4]);
        const expectedBase64 = Buffer.from(mockBinaryState).toString('base64');

        vi.mocked(transformModule.yjsDocToBinaryStateV2).mockReturnValue(mockBinaryState);
        mockIntegrationService.save.mockResolvedValue(new SaveOutputData(new SaveContentData()));

        // Act
        await service.save(documentId, mockDoc);

        // Assert
        expect(transformModule.yjsDocToBinaryStateV2).toHaveBeenCalledWith(mockDoc);
        expect(mockIntegrationService.save).toHaveBeenCalledWith(
          new SaveInputData(documentId, expectedBase64)
        );
      });
    });
  });

  describe('fetchMemo', () => {
    const documentId = 'test-doc-id';

    describe('failing paths', () => {
      it('should throw FetchException when fetch returns error data', async () => {
        // Arrange
        const errorData = new FetchErrorData('Document not found', FetchErrorCodes.NOT_FOUND);
        const fetchOutput = new FetchOutputData(errorData);
        mockIntegrationService.fetch.mockResolvedValue(fetchOutput);

        // Act & Assert
        await expect(service.fetchMemo(documentId)).rejects.toThrow(FetchException);
        await expect(service.fetchMemo(documentId)).rejects.toThrow('Failed to fetch memo');

        expect(mockIntegrationService.fetch).toHaveBeenCalledWith(
          new FetchInputData(documentId)
        );
      });
    });

    describe('green paths', () => {
      it('should fetch memo and convert to Y.Doc when content is provided', async () => {
        // Arrange
        const contentBase64 = 'dGVzdCBjb250ZW50'; // "test content" in base64
        const contentData = new FetchContentData(contentBase64);
        const fetchOutput = new FetchOutputData(contentData);
        const mockDoc = new Y.Doc();
        const expectedBuffer = Buffer.from(contentBase64, 'base64');

        mockIntegrationService.fetch.mockResolvedValue(fetchOutput);
        vi.mocked(transformModule.binaryStateV2ToYjsDoc).mockReturnValue(mockDoc);

        // Act
        const result = await service.fetchMemo(documentId);

        // Assert
        expect(mockIntegrationService.fetch).toHaveBeenCalledWith(
          new FetchInputData(documentId)
        );
        expect(transformModule.binaryStateV2ToYjsDoc).toHaveBeenCalledWith(expectedBuffer);
        expect(result).toBe(mockDoc);
      });

      it('should handle empty content by passing undefined to transform function', async () => {
        // Arrange
        const contentData = new FetchContentData(undefined);
        const fetchOutput = new FetchOutputData(contentData);
        const mockDoc = new Y.Doc();

        mockIntegrationService.fetch.mockResolvedValue(fetchOutput);
        vi.mocked(transformModule.binaryStateV2ToYjsDoc).mockReturnValue(mockDoc);

        // Act
        const result = await service.fetchMemo(documentId);

        // Assert
        expect(transformModule.binaryStateV2ToYjsDoc).toHaveBeenCalledWith(undefined);
        expect(result).toBe(mockDoc);
      });

      it('should handle undefined contentBase64', async () => {
        // Arrange
        const contentData = new FetchContentData(undefined);
        const fetchOutput = new FetchOutputData(contentData);
        const mockDoc = new Y.Doc();

        mockIntegrationService.fetch.mockResolvedValue(fetchOutput);
        vi.mocked(transformModule.binaryStateV2ToYjsDoc).mockReturnValue(mockDoc);

        // Act
        const result = await service.fetchMemo(documentId);

        // Assert
        expect(transformModule.binaryStateV2ToYjsDoc).toHaveBeenCalledWith(undefined);
        expect(result).toBe(mockDoc);
      });
    });
  });
});
