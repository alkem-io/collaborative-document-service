import { Doc as YjsDoc } from 'yjs';
import { BaseInputData } from './base.input.data';

/**
 * Class representing the data input for when content is modified.
 */
export class SaveInputData extends BaseInputData {
  /**
   * Creates a new ContentModifiedInputData instance.
   * @param {string} whiteboardId - The ID of the whiteboard which is going to be saved.
   * @param {YjsDoc} content - The content of the whiteboard. Must be a valid Excalidraw whiteboard content
   */
  constructor(
    public whiteboardId: string,
    public content: YjsDoc
  ) {
    super('save-input');
  }
}
