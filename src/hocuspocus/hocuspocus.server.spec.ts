import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ConfigService } from '@nestjs/config';
import { HocuspocusServer } from './hocuspocus.server';
import { AlkemioAuthenticator, ALKEMIO_AUTHENTICATION_EXTENSION } from './extensions/authentication/alkemio-authenticator';
import { AlkemioAuthorizer, ALKEMIO_AUTHORIZATION_EXTENSION } from './extensions/authorization/alkemio-authorizer';
import { AlkemioStorage, ALKEMIO_STORAGE_EXTENSION } from './extensions/storage/alkemio-storage';
import { NorthStarMetric, NORTH_STAR_METRIC_EXTENSION } from './extensions/north-star-metric';
import { Server, Hocuspocus } from '@hocuspocus/server';

describe('HocuspocusServer', () => {
  let service: HocuspocusServer;
  let mockConfigService: MockProxy<ConfigService>;
  let mockAuthentication: MockProxy<AlkemioAuthenticator>;
  let mockAuthorization: MockProxy<AlkemioAuthorizer>;
  let mockStorage: MockProxy<AlkemioStorage>;
  let mockNorthStarMetric: MockProxy<NorthStarMetric>;

  beforeEach(async () => {
    mockConfigService = mock<ConfigService>();
    mockAuthentication = mock<AlkemioAuthenticator>();
    mockAuthorization = mock<AlkemioAuthorizer>();
    mockStorage = mock<AlkemioStorage>();
    mockNorthStarMetric = mock<NorthStarMetric>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HocuspocusServer,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ALKEMIO_AUTHENTICATION_EXTENSION,
          useValue: mockAuthentication,
        },
        {
          provide: ALKEMIO_AUTHORIZATION_EXTENSION,
          useValue: mockAuthorization,
        },
        {
          provide: ALKEMIO_STORAGE_EXTENSION,
          useValue: mockStorage,
        },
        {
          provide: NORTH_STAR_METRIC_EXTENSION,
          useValue: mockNorthStarMetric,
        },
      ],
    }).compile();

    service = module.get<HocuspocusServer>(HocuspocusServer);
  });

  describe('constructor', () => {
    it('should create an instance with sorted extensions', () => {
      // Assert
      expect(service).toBeDefined();
      expect(service.getServer()).toBeDefined();
    });

    it('should assign priorities to extensions in correct order', () => {
      // Arrange & Act
      const server = service.getServer();

      // Assert
      expect(server).toBeDefined();
      // Extensions should be sorted with Authentication having highest priority
      expect(mockAuthentication.priority).toBe(4);
      expect(mockAuthorization.priority).toBe(3);
      expect(mockStorage.priority).toBe(2);
      expect(mockNorthStarMetric.priority).toBe(1);
    });
  });

  describe('onModuleInit', () => {
    it('should start the server on the configured port', async () => {
      // Arrange
      const expectedPort = 8080;
      mockConfigService.get.mockReturnValue(expectedPort);
      // Act
      await service.onModuleInit();

      // Assert
      expect(mockConfigService.get).toHaveBeenCalledWith('settings.application.ws_port', { infer: true });
      expect(service.getServer().configuration.port).toEqual(expectedPort);
    });
  });

  describe('onModuleDestroy', () => {
    it('should destroy the server on module destroy', async () => {
      // Arrange
      const destroySpy = vi.spyOn(service.getServer(), 'destroy').mockResolvedValue(undefined);

      // Act
      await service.onModuleDestroy();

      // Assert
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('getServer', () => {
    it('should return the hocuspocus server instance', () => {
      // Act
      const result = service.getServer();

      // Assert
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Server);
    });
  });

  describe('getInstance', () => {
    it('should return the hocuspocus instance', () => {
      // Act
      const result = service.getInstance();

      // Assert
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Hocuspocus);
    });
  });
});

