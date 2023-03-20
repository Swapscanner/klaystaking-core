import fs from 'node:fs';
import path from 'node:path';
import { stdout } from 'node:process';
import util from 'node:util';

const parsePathFromStack = (stack: string) => {
  const [, filepath, row, col] = stack.match(/\((.+):([0-9]+):([0-9]+)\)$/) || [];
  if (!filepath) {
    const [, mfilepath, mrow, mcol] = stack.match(/at (.+):([0-9]+):([0-9]+)$/) || [];
    if (!mfilepath) {
      throw new Error('NO MATCH FOUND FOR ' + stack);
    }
    return { filepath: mfilepath, row: mrow, col: mcol };
  }
  return { filepath, row, col };
};

export const useLogger = ({ suppressOnSuccess = true } = {}) => {
  const useLoggerFileLocation = path.dirname(
    parsePathFromStack((new Error().stack ?? '').split('\n')[2].trim()).filepath,
  );

  let buffer = '';

  afterEach(function () {
    if (!buffer) return;
    if (!suppressOnSuccess || this.currentTest?.state === 'failed') {
      fs.writeSync(stdout.fd, buffer);
    }
    buffer = '';
  });

  const log = (msg: any, { stackOffset = 0 } = {}) => {
    const { filepath, row, col } = parsePathFromStack(
      (new Error().stack ?? '').split('\n')[2 + stackOffset].trim(),
    );
    const location = `${path.relative(useLoggerFileLocation, filepath)}:${row}:${col}`;
    buffer +=
      (typeof msg === 'string' ? msg : util.inspect(msg, { depth: null }))
        .split('\n')
        .map((l) => `${location}> ${l}`)
        .join('\n') + '\n';
  };

  log.fromUtil = (msg: any) => log(msg, { stackOffset: 6 });

  return log;
};
