import {approximateTokenCount, decodeInt, encodeInt, userDataDir} from "../src/utils";
import {Register} from "../src/register";
import FilesystemBufferedLogger from "../src/trackers/filesystemBufferedLogger";
import FunctionModeler from "../src/functionModeler";
import {APIManager} from "../src/APIManager";
import {FinetuneJob} from "../src/models/finetuneJob";
import {OpenAIConfig} from "../src/languageModels/llmConfigs/openAIConfig";

describe('approximateTokenCount', () => {
    test('accurately approximates token count for given content', () => {
        const content = "Hello, world! This is a test."; // Assume 7 words, 2 special characters
        const expectedTokenCount = Math.ceil(6 * 1.333); // Calculation based on the function's logic
        expect(approximateTokenCount(content)).toEqual(expectedTokenCount);
    });
});

describe('userDataDir', () => {
    test('returns correct path for Windows', () => {
        Object.defineProperty(process, 'platform', { value: 'win32' });
        const path = userDataDir('TestApp', 'TestAuthor', '1.0', false);
        // Since actual paths depend on the runtime environment, use a partial match or mock `homedir` and environment variables
        expect(path).toContain('/AppData/Local/TestAuthor/TestApp/1.0');
    });

    test('returns correct path for Linux without appname', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        const path = userDataDir();
        // Assuming default behavior without XDG_DATA_HOME set
        expect(path).toContain('.local/share');
    });

    test('returns correct path for Linux with appname', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        const appName = 'TestApp';
        const path = userDataDir(appName);
        expect(path).toContain(`.local/share/${appName}`);
    });

    test('returns correct path for Linux with appname and version', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        const appName = 'TestApp';
        const version = '1.0';
        const path = userDataDir(appName, undefined, version);
        expect(path).toContain(`.local/share/${appName}/${version}`);
    });

    // Optional: Test with XDG_DATA_HOME set
    test('respects XDG_DATA_HOME environment variable', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env.XDG_DATA_HOME = '/custom';
        const appName = 'TestApp';
        const path = userDataDir(appName);
        expect(path).toBe('/custom/TestApp');
        delete process.env.XDG_DATA_HOME; // Clean up
    });
});

describe('encodeInt and decodeInt', () => {
    test('encodeInt correctly encodes integers', () => {
        expect(encodeInt(1)).toBe('!');
        expect(encodeInt(94)).toBe('~');
    });

    test('decodeInt correctly decodes characters to integers', () => {
        expect(decodeInt('!')).toBe(1);
        expect(decodeInt('~')).toBe(94); // Adjust based on actual logic
    });

    test('encoding and decoding are inverses', () => {
        const original = 42;
        const encoded = encodeInt(original);
        const decoded = decodeInt(encoded);
        expect(decoded).toBe(original);
    });

    test('iterate encodings', () => {
        const ints: number[] = [];
        const characters: string[] = [];

        for (let i = 0; i < 37; i++) {
            const character = encodeInt(i);
            expect(characters).not.toContain(character);
            characters.push(character);

            const integer = decodeInt(character);
            expect(ints).not.toContain(integer);
            ints.push(integer);

            expect(integer).toBe(i);
        }
    });
});
