import { expect } from '@jest/globals';
import type { MatcherFunction } from 'expect';

const toSucceed: MatcherFunction<[]> = function (response: any) {
    if (Array.isArray(response) || response.error === false || response.errors === false) {
        return {
            pass: true,
            message: () => "Request succeeded"
        }
    }

    var msg: string;
    if (response.response && response.response.data) {
        msg = response.response.data.message
    } else if (Array.isArray(response.result)) {
        msg = response.result[0];
    }
    else {
        msg = response.message;
    }

    return {
        pass: false,
        message: () => `Request failed with error: ${msg}`
    }
}

expect.extend({
    toSucceed,
});

declare global {
    namespace jest {
        interface AsymmetricMatchers {
            toSucceed(): void;
        }
        interface Matchers<R> {
            toSucceed(): R;
        }
    }
}

export { toSucceed }
