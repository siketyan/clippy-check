/**
 * Parse action input into a some proper thing.
 */

import { getInput } from "@actions/core";
import stringArgv from "string-argv";

// Parsed action input
export interface ActionInput {
    token: string;
    toolchain?: string;
    args: string[];
    useCross: boolean;
    name: string;
}

export function getActionInput(): ActionInput {
    const args = stringArgv(getInput("args"));
    let toolchain = getInput("toolchain");
    if (toolchain.startsWith("+")) {
        toolchain = toolchain.slice(1);
    }
    const useCross = getInput("use-cross") === "true";
    const name = getInput("name");

    return {
        token: getInput("token", { required: true }),
        args: args,
        useCross: useCross,
        toolchain: toolchain || undefined,
        name,
    };
}
