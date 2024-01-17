import { homedir } from 'os';
import { join } from 'path';

function _notImplemented() : never {
  throw new Error("not Implemented")
}
function approximateTokenCount(content: string): number {
  const commonSpecialCharacters = "\\/(){}[]<>|`~@#$%^&*+=-_:;\"";
  const numberOfWordTokens = Math.ceil(content.split(" ").length * 1.333);
  const numberOfSpecialCharacters = Array.from(commonSpecialCharacters).reduce((count, char) => {
    return count + (content.split(char).length - 1);
  }, 0);

  return numberOfWordTokens + numberOfSpecialCharacters;
}

function userDataDir(appname?: string, appauthor?: string | false, version?: string, roaming = false): string {
  let path = "";

  switch (process.platform) {
    case "win32": {
      const appData = process.env[roaming ? 'APPDATA' : 'LOCALAPPDATA'] || join(homedir(), "AppData", roaming ? "Roaming" : "Local");
      appauthor = appauthor === undefined ? appname : appauthor;
      if (appname) {
        if (appauthor != null) {
          path = appauthor !== false ? join(appData, appauthor, appname) : join(appData, appname);
        }
      } else {
        path = appData;
      }
      break;
    }
    case "darwin":
      path = join(homedir(), 'Library', 'Application Support');
      if (appname) {
        path = join(path, appname);
      }
      break;
    default: // 'linux', 'freebsd', etc.
      path = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
      if (appname) {
        path = join(path, appname);
      }
      break;
  }

  if (appname && version) {
    path = join(path, version);
  }

  return path;
}

function encodeInt(n: number): string {
  // ASCII characters from space (32) to tilde (126)
  const charset = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join('');
  return charset.charAt(n);
}

function decodeInt(s: string): number {
  // ASCII characters from space (32) to tilde (126)
  const charset = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join('');
  return charset.indexOf(s);
}


export { approximateTokenCount, userDataDir, decodeInt, encodeInt };
