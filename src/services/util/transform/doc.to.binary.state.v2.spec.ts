import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { yjsDocToBinaryStateV2 } from './doc.to.binary.state.v2';

describe('yjsDocToBinaryStateV2', () => {
  describe('green paths', () => {
    it('should convert empty Y.Doc to binary state v2', () => {
      // Arrange
      const doc = new Y.Doc();

      // Act
      const result = yjsDocToBinaryStateV2(doc);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should convert Y.Doc with text content to binary state v2', () => {
      // Arrange
      const doc = new Y.Doc();
      const yText = doc.getText('content');
      yText.insert(0, 'Hello World');

      // Act
      const result = yjsDocToBinaryStateV2(doc);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify the binary state can be used to recreate the document
      const newDoc = new Y.Doc();
      Y.applyUpdateV2(newDoc, result);
      expect(newDoc.getText('content').toString()).toBe('Hello World');
    });

    it('should convert Y.Doc with multiple shared types to binary state v2', () => {
      // Arrange
      const doc = new Y.Doc();
      const yText = doc.getText('text');
      const yArray = doc.getArray('array');
      const yMap = doc.getMap('map');

      yText.insert(0, 'Test text');
      yArray.push(['item1', 'item2']);
      yMap.set('key1', 'value1');

      // Act
      const result = yjsDocToBinaryStateV2(doc);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify the binary state preserves all data types
      const newDoc = new Y.Doc();
      Y.applyUpdateV2(newDoc, result);
      expect(newDoc.getText('text').toString()).toBe('Test text');
      expect(newDoc.getArray('array').toArray()).toEqual(['item1', 'item2']);
      expect(newDoc.getMap('map').get('key1')).toBe('value1');
    });

    it('should convert Y.Doc with complex text operations to binary state v2', () => {
      // Arrange
      const doc = new Y.Doc();
      const yText = doc.getText('document');

      // Perform complex operations
      yText.insert(0, 'Initial content');
      yText.delete(8, 7); // Delete "content"
      yText.insert(8, 'text modified');
      yText.format(0, 7, { bold: true });

      // Act
      const result = yjsDocToBinaryStateV2(doc);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify complex operations are preserved
      const newDoc = new Y.Doc();
      Y.applyUpdateV2(newDoc, result);
      const newText = newDoc.getText('document');
      expect(newText.toString()).toBe('Initial text modified');

      const delta = newText.toDelta();
      expect(delta[0]).toEqual({ insert: 'Initial', attributes: { bold: true } });
      expect(delta[1]).toEqual({ insert: ' text modified' });
    });

    it('should produce valid binary output for identical document content', () => {
      // Arrange
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      // Create identical content in both documents
      doc1.getText('test').insert(0, 'Same content');
      doc2.getText('test').insert(0, 'Same content');

      // Act
      const result1 = yjsDocToBinaryStateV2(doc1);
      const result2 = yjsDocToBinaryStateV2(doc2);

      // Assert
      expect(result1).toBeInstanceOf(Uint8Array);
      expect(result2).toBeInstanceOf(Uint8Array);
      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBeGreaterThan(0);

      // Verify both can recreate the same content (even if binary differs due to timestamps)
      const newDoc1 = new Y.Doc();
      const newDoc2 = new Y.Doc();
      Y.applyUpdateV2(newDoc1, result1);
      Y.applyUpdateV2(newDoc2, result2);

      expect(newDoc1.getText('test').toString()).toBe('Same content');
      expect(newDoc2.getText('test').toString()).toBe('Same content');
    });

    it('should handle nested shared types in Y.Doc', () => {
      // Arrange
      const doc = new Y.Doc();
      const yMap = doc.getMap('root');
      const nestedArray = new Y.Array();
      const nestedMap = new Y.Map();

      nestedArray.push(['nested1', 'nested2']);
      nestedMap.set('nestedKey', 'nestedValue');

      yMap.set('array', nestedArray);
      yMap.set('map', nestedMap);
      yMap.set('primitive', 'primitiveValue');

      // Act
      const result = yjsDocToBinaryStateV2(doc);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify nested structures are preserved
      const newDoc = new Y.Doc();
      Y.applyUpdateV2(newDoc, result);
      const newMap = newDoc.getMap('root');

      expect(newMap.get('primitive')).toBe('primitiveValue');
      expect((newMap.get('array') as Y.Array<any>).toArray()).toEqual(['nested1', 'nested2']);
      expect((newMap.get('map') as Y.Map<any>).get('nestedKey')).toBe('nestedValue');
    });

    it('should handle large documents efficiently', () => {
      // Arrange
      const doc = new Y.Doc();
      const yText = doc.getText('large');

      // Create a large document with repetitive content
      const largeContent = 'This is a repeated line of text. '.repeat(1000);
      yText.insert(0, largeContent);

      // Act
      const result = yjsDocToBinaryStateV2(doc);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify content is preserved
      const newDoc = new Y.Doc();
      Y.applyUpdateV2(newDoc, result);
      expect(newDoc.getText('large').toString()).toBe(largeContent);

      // Verify the binary format is reasonable (not excessively large)
      expect(result.length).toBeLessThan(largeContent.length * 2);
    });
  });
});

