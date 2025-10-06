import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { binaryStateV2ToYjsDoc } from './binary.state.v2.to.doc';

describe('binaryStateV2ToYjsDoc', () => {
  describe('failing paths', () => {
    it('should create empty Y.Doc when binaryV2State is undefined', () => {
      // Arrange
      const binaryV2State = undefined;

      // Act
      const result = binaryStateV2ToYjsDoc(binaryV2State);

      // Assert
      expect(result).toBeInstanceOf(Y.Doc);
      expect(result.share.size).toBe(0);
    });

    it('should create empty Y.Doc when binaryV2State is valid buffer', () => {
      // Arrange
      const doc = new Y.Doc();
      const binaryV2State = Buffer.from(Y.encodeStateAsUpdateV2(doc));

      // Act
      const result = binaryStateV2ToYjsDoc(binaryV2State);

      // Assert
      expect(result).toBeInstanceOf(Y.Doc);
      expect(result.share.size).toBe(0);
    });

    it('should handle invalid binary data gracefully', () => {
      // Arrange
      const invalidBinaryData = Buffer.from([255, 255, 255, 255]);

      // Act & Assert
      expect(() => binaryStateV2ToYjsDoc(invalidBinaryData)).toThrow();
    });
  });

  describe('green paths', () => {
    it('should create Y.Doc from valid binary state v2', () => {
      // Arrange
      const sourceDoc = new Y.Doc();
      const yText = sourceDoc.getText('content');
      yText.insert(0, 'Hello World');

      const binaryStateV2 = Y.encodeStateAsUpdateV2(sourceDoc);
      const binaryBuffer = Buffer.from(binaryStateV2);

      // Act
      const result = binaryStateV2ToYjsDoc(binaryBuffer);

      // Assert
      expect(result).toBeInstanceOf(Y.Doc);
      const resultText = result.getText('content');
      expect(resultText.toString()).toBe('Hello World');
    });

    it('should create Y.Doc with multiple shared types from binary state', () => {
      // Arrange
      const sourceDoc = new Y.Doc();
      const yText = sourceDoc.getText('text');
      const yArray = sourceDoc.getArray('array');
      const yMap = sourceDoc.getMap('map');

      yText.insert(0, 'Test text');
      yArray.push(['item1', 'item2']);
      yMap.set('key1', 'value1');

      const binaryStateV2 = Y.encodeStateAsUpdateV2(sourceDoc);
      const binaryBuffer = Buffer.from(binaryStateV2);

      // Act
      const result = binaryStateV2ToYjsDoc(binaryBuffer);

      // Assert
      expect(result).toBeInstanceOf(Y.Doc);
      expect(result.getText('text').toString()).toBe('Test text');
      expect(result.getArray('array').toArray()).toEqual(['item1', 'item2']);
      expect(result.getMap('map').get('key1')).toBe('value1');
    });

    it('should preserve document structure and content from complex binary state', () => {
      // Arrange
      const sourceDoc = new Y.Doc();
      const yText = sourceDoc.getText('document');

      // Create a more complex document structure
      yText.insert(0, 'Initial content');
      yText.delete(8, 7); // Delete "content"
      yText.insert(8, 'text modified');
      yText.format(0, 7, { bold: true });

      const binaryStateV2 = Y.encodeStateAsUpdateV2(sourceDoc);
      const binaryBuffer = Buffer.from(binaryStateV2);

      // Act
      const result = binaryStateV2ToYjsDoc(binaryBuffer);

      // Assert
      expect(result).toBeInstanceOf(Y.Doc);
      const resultText = result.getText('document');
      expect(resultText.toString()).toBe('Initial text modified');

      // Check formatting is preserved
      const delta = resultText.toDelta();
      expect(delta[0]).toEqual({ insert: 'Initial', attributes: { bold: true } });
      expect(delta[1]).toEqual({ insert: ' text modified' });
    });

    it('should handle empty Y.Doc serialization and deserialization', () => {
      // Arrange
      const sourceDoc = new Y.Doc();
      const binaryStateV2 = Y.encodeStateAsUpdateV2(sourceDoc);
      const binaryBuffer = Buffer.from(binaryStateV2);

      // Act
      const result = binaryStateV2ToYjsDoc(binaryBuffer);

      // Assert
      expect(result).toBeInstanceOf(Y.Doc);
      expect(result.share.size).toBe(0);
    });
  });
});
