import { BaseInputData } from './base.input.data';

/**
 * Class representing the data input for when fetching the content of a document.
 */
export class FetchInputData extends BaseInputData {
  /**
   * @param {string} documentId - The ID of the document which content is going to be fetched.
   */
  constructor(public documentId: string) {
    super('fetch-input');
  }
}
