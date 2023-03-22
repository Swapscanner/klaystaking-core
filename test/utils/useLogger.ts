import fs from 'node:fs';
import { stdout } from 'node:process';
import util from 'node:util';

export const useLogger = ({ suppressOnSuccess = true } = {}) => {
  let buffer = '';

  afterEach(function () {
    if (!buffer) return;
    if (!suppressOnSuccess || this.currentTest?.state === 'failed') {
      fs.writeSync(stdout.fd, buffer);
    }
    buffer = '';
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const log = (msg: any) => {
    buffer +=
      (typeof msg === 'string' ? msg : util.inspect(msg, { depth: null }))
        .split('\n')
        .map((l) => `${l}`)
        .join('\n') + '\n';
  };

  return log;
};
