import type {Config} from 'jest';
import { promises as fs } from 'fs';

const config: Config = {
    verbose: true,
    testTimeout: 60000,
    testEnvironment: "node",
    transform: {
        ".(ts|tsx)": "ts-jest"
    },
    modulePathIgnorePatterns: [
        "dist",
        "examples"
    ],
    moduleFileExtensions: [
        "ts",
        "tsx",
        "js"
    ]
};

export default async (): Promise<Config> => {
    try {
         const json = JSON.parse(await fs.readFile(__dirname + "/.local_env.json", "utf8"));
         Object.assign(process.env, json);
    } catch(_e) {
        // ignore any error
    }

    try {
        const json = JSON.parse(await fs.readFile(__dirname + "/.local_jest.json", "utf8"));
        Object.assign(config, json);
    } catch(_e) {
        // ignore any error 
    }

    return config;
};
