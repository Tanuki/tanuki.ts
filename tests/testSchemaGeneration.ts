import tsj from "ts-json-schema-generator";

const fs = require("fs");

/** @type {import('ts-json-schema-generator/dist/src/Config').Config} */
const config = {
  path: "path/to/source/file",
  tsconfig: "path/to/tsconfig.json",
  type: "*", // Or <type-name> if you want to generate schema for that one type only
};


const schema = tsj.createGenerator(config).createSchema(config.type);
const schemaString = JSON.stringify(schema, null, 2);