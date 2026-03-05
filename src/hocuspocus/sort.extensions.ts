import { Extension } from "@hocuspocus/server";

/**
 * Assigns a sort order to extensions based on their order in the array,
 * starting from index 0, assigning it the highest priority.
 * @param array
 */
export const sortExtensions = (array: Array<Extension>): Array<Extension> => {
  const highestPriority = array.length;
  return array.map((extension, index) => {
    extension.priority = highestPriority - index;
    return extension;
  });
};
