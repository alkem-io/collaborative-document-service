import { readFileSync } from 'fs';
import { join } from 'path';
import * as YAML from 'yaml';
import path from 'path';
import { fileURLToPath } from 'url';

const YAML_CONFIG_FILENAME = 'config.yml';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

export default () => {
  const rawYaml = readFileSync(join(__dirname, '../../', YAML_CONFIG_FILENAME), 'utf8');

  const doc = YAML.parseDocument(rawYaml);
  const envConfig = process.env;

  YAML.visit(doc, {
    Scalar(key, node) {
      if (node.type === 'PLAIN') {
        node.value = buildYamlNodeValue(node.value, envConfig);
      }
    },
  });

  return doc.toJSON() as Record<string, any>;
};

function buildYamlNodeValue(nodeValue: any, envConfig: any) {
  let updatedNodeValue = nodeValue;
  const key = `${nodeValue}`;
  const regex = '\\${(.*)}:?(.*)';
  const found = key.match(regex);
  if (found) {
    const envVariableKey = found[1];
    const envVariableDefaultValue = found[2];

    updatedNodeValue = envConfig[envVariableKey] ?? envVariableDefaultValue;

    if (updatedNodeValue.toLowerCase() === 'true') return true;
    if (updatedNodeValue.toLowerCase() === 'false') return false;
    if (!isNaN(updatedNodeValue)) return Number(updatedNodeValue);
  }

  return updatedNodeValue;
}
