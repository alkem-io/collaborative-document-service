import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Extension, Hocuspocus, Server } from '@hocuspocus/server';
import { ConfigType } from '../config';
import {
  AlkemioAuthorizer,
  ALKEMIO_AUTHORIZATION_EXTENSION,
} from './extensions/authorization/alkemio-authorizer';
import {
  AlkemioAuthenticator,
  ALKEMIO_AUTHENTICATION_EXTENSION,
} from './extensions/authentication/alkemio-authenticator';
import {
  ALKEMIO_STORAGE_EXTENSION,
  AlkemioStorage,
} from '@src/hocuspocus/extensions/storage/alkemio-storage';

@Injectable()
export class HocuspocusServer implements OnModuleInit, OnModuleDestroy {
  private readonly hocuspocusServer: Server;

  constructor(
    private readonly config: ConfigService<ConfigType, true>,
    @Inject(ALKEMIO_AUTHENTICATION_EXTENSION) Authentication: AlkemioAuthenticator,
    @Inject(ALKEMIO_AUTHORIZATION_EXTENSION) Authorization: AlkemioAuthorizer,
    @Inject(ALKEMIO_STORAGE_EXTENSION) Storage: AlkemioStorage
  ) {
    const extensions = sortExtensions([Authentication, Authorization, Storage]);
    this.hocuspocusServer = new Server({
      extensions,
    });
  }
  async onModuleInit() {
    const port = this.config.get('settings.application.ws_port', { infer: true });
    await this.hocuspocusServer.listen(port);
  }

  async onModuleDestroy() {
    await this.hocuspocusServer.destroy();
  }

  public getServer(): Server {
    return this.hocuspocusServer;
  }

  public getInstance(): Hocuspocus {
    return this.hocuspocusServer.hocuspocus;
  }

  /**
   * @returns The number of registered connections to the document. That does not include direct connections.
   */
  getConnections(instance: Hocuspocus, documentName: string) {
    return instance.documents.get(documentName)?.getConnections() ?? [];
  }

  /**
   * Gets all read-only connections for a document.
   */
  getReadOnlyConnections(instance: Hocuspocus, documentName: string) {
    const connections = this.getConnections(instance, documentName);

    if (!connections || connections.length === 0) {
      return [];
    }

    return connections.filter(connection => connection.readOnly);
  }

  /**
   * Gets all collaborator (non-read-only) connections for a document.
   */
  getCollaboratorConnections(instance: Hocuspocus, documentName: string) {
    const connections = this.getConnections(instance, documentName);

    if (!connections || connections.length === 0) {
      return [];
    }

    return connections.filter(connection => !connection.readOnly);
  }
}
/**
 * Assigns a sort order to extensions based on their order in the array,
 * starting from index 0, assigning it the highest priority.
 * @param array
 */
const sortExtensions = (array: Array<Extension>): Array<Extension> => {
  const highestPriority = array.length;
  return array.map((extension, index) => {
    extension.priority = highestPriority - index;
    return extension;
  });
};
