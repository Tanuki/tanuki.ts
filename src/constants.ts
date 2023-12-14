
export const EXAMPLE_ELEMENT_LIMIT = 1000

// These represent the file extensions for the symbolic patch and alignment datasets
export const PATCHES = 'patches';
export type PATCH_FILE_EXTENSION_TYPE = '.patches';
export const PATCH_FILE_EXTENSION: PATCH_FILE_EXTENSION_TYPE = '.patches';

export const SYMBOLIC_ALIGNMENTS = 'alignments';
export type ALIGN_FILE_EXTENSION_TYPE = '.alignments';
export const ALIGN_FILE_EXTENSION: ALIGN_FILE_EXTENSION_TYPE = '.alignments';

// These represent the file extensions for the embeddable examples positive and negative datasets
export const POSITIVE_EMBEDDABLE_ALIGNMENTS = 'positive';
export type POSITIVE_FILE_EXTENSION_TYPE = '.positive';
export const POSITIVE_FILE_EXTENSION: POSITIVE_FILE_EXTENSION_TYPE = '.positive'

export const NEGATIVE_EMBEDDABLE_ALIGNMENTS = 'negative';
export type NEGATIVE_FILE_EXTENSION_TYPE = '.negative';
export const NEGATIVE_FILE_EXTENSION: NEGATIVE_FILE_EXTENSION_TYPE = '.negative';

// Bloom filter default config
export const EXPECTED_ITEMS = 10000
export const FALSE_POSITIVE_RATE = 0.01

// The name of the library
export const LIB_NAME = 'tanuki';
export const ENVVAR = 'TANUKI_LOG_DIR';
