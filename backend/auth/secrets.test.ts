import {afterEach, beforeEach, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({encoreValue: ""}));

vi.mock("encore.dev/config", () => ({
    secret: () => () => mocks.encoreValue,
}));

import {apacsDbPassword} from "./secrets";

const originalApacsPassword = process.env.APACS_DB_PASSWORD;

beforeEach(() => {
    mocks.encoreValue = "";
    delete process.env.APACS_DB_PASSWORD;
});

afterEach(() => {
    if (originalApacsPassword === undefined) delete process.env.APACS_DB_PASSWORD;
    else process.env.APACS_DB_PASSWORD = originalApacsPassword;
});

it("reads the APACS password from Encore first, preserving whitespace in credentials", () => {
    process.env.APACS_DB_PASSWORD = ' env-secret ';
    expect(apacsDbPassword()).toBe(' env-secret ');
    mocks.encoreValue = ' encore-secret ';
    expect(apacsDbPassword()).toBe(' encore-secret ');
});
