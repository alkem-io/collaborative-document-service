import * as Y from 'yjs';

export const binaryStateV2ToYjsDoc = (binaryV2State: Buffer | undefined): Y.Doc => {
  const doc = new Y.Doc();

  if (binaryV2State) {
    Y.applyUpdateV2(doc, new Uint8Array(binaryV2State));
  }

  return doc;
};
