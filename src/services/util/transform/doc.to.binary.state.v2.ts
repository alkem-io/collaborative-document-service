import * as Y from 'yjs';

/**
 * Returns the v2 binary state of the Y.Doc. V2 update format provides much better compression.
 *
 * <b>To not be confused with the v1 binary state, which is not compatible with the v2.</b>
 * @param doc
 */
export const yjsDocToBinaryStateV2 = (doc: Y.Doc): Uint8Array => {
  return Y.encodeStateAsUpdateV2(doc);
};
