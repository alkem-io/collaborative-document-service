import { Injectable } from '@nestjs/common';
import { Hocuspocus } from '@hocuspocus/server';

@Injectable()
export class HocuspocusConnectionService {
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
