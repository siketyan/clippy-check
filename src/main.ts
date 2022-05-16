import core from "@actions/core";
import exec from "@actions/exec";
import github from "@actions/github";

import { ActionInput, getActionInput } from "./input";
import { Cargo, get } from "./cargo";
import { CheckRunner } from "./check";
import { getOrInstall } from "./cross";

async function getVersions(program: Cargo) {
    let rustcVersion = "";
    let cargoVersion = "";
    let clippyVersion = "";
    await exec.exec("rustc", ["-V"], {
        silent: true,
        listeners: {
            stdout: (buffer: Buffer) =>
                (rustcVersion = buffer.toString().trim()),
        },
    });
    await program.call(["-V"], {
        silent: true,
        listeners: {
            stdout: (buffer: Buffer) =>
                (cargoVersion = buffer.toString().trim()),
        },
    });
    await program.call(["clippy", "-V"], {
        silent: true,
        listeners: {
            stdout: (buffer: Buffer) =>
                (clippyVersion = buffer.toString().trim()),
        },
    });
    return { rustcVersion, cargoVersion, clippyVersion };
}

export async function run(actionInput: ActionInput): Promise<void> {
    const startedAt = new Date().toISOString();

    let program;
    if (actionInput.useCross) {
        program = await getOrInstall();
    } else {
        program = await get();
    }

    // TODO: Simplify this block
    const { rustcVersion, cargoVersion, clippyVersion } = await getVersions(
        program
    );

    const args: string[] = [];
    // Toolchain selection MUST go first in any condition
    if (actionInput.toolchain) {
        args.push(`+${actionInput.toolchain}`);
    }
    args.push("clippy");
    // `--message-format=json` should just right after the `cargo clippy`
    // because usually people are adding the `-- -D warnings` at the end
    // of arguments and it will mess up the output.
    args.push("--message-format=json");

    args.push(...actionInput.args);

    const runner = new CheckRunner();
    let clippyExitCode: number = 0;
    try {
        core.startGroup("Executing cargo clippy (JSON output)");
        clippyExitCode = await program.call(args, {
            ignoreReturnCode: true,
            failOnStdErr: false,
            listeners: {
                stdline: (line: string) => {
                    runner.tryPush(line);
                },
            },
        });
    } finally {
        core.endGroup();
    }

    const sha: string =
        github.context.payload.pull_request?.head?.sha ?? github.context.sha;

    await runner.executeCheck({
        token: actionInput.token,
        name: actionInput.name,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        head_sha: sha,
        started_at: startedAt,
        context: {
            rustc: rustcVersion,
            cargo: cargoVersion,
            clippy: clippyVersion,
        },
    });

    if (clippyExitCode !== 0) {
        throw new Error(
            `Clippy had exited with the ${clippyExitCode} exit code`
        );
    }
}

async function main(): Promise<void> {
    try {
        const actionInput = getActionInput();

        await run(actionInput);
    } catch (error) {
        core.setFailed((<Error>error).message);
    }
}

void main();
