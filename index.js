import { execa, execaCommand } from "execa";
import createApp from "noclis";

const app = createApp(cli =>
  cli
    .option(opt =>
      opt.name("git").desc("Use git?").type("boolean").default(true)
    )
    .option(opt =>
      opt.name("npm").desc("Use npm?").type("boolean").default(true)
    )
    .option(opt =>
      opt
        .name("otp")
        .desc("Command to get an otp for npm")
        .type("string")
        .cli(false)
        .prompt({
          type: "input",
          message: "Enter a command that will get an otp"
        })
    )
    .option(opt =>
      opt
        .name("preid")
        .desc("Prerelease ID")
        .type("string")
        .prompt({
          type: "select",
          message: "What's the prerelease ID?",
          choices: ["", "alpha", "beta", "pre"]
        })
    )
    .argument(arg =>
      arg
        .name("version")
        .desc("Version bump")
        .type("string")
        .choices([
          "major",
          "minor",
          "patch",
          "premajor",
          "preminor",
          "prepatch",
          "prerelease"
        ])
        .required()
        .prompt({
          type: "select",
          message: "What version bump?",
          choices: [
            "major",
            "minor",
            "patch",
            "premajor",
            "preminor",
            "prepatch",
            "prerelease"
          ]
        })
    )
    .argument(arg =>
      arg
        .name("message")
        .desc("Commit message to use")
        .type("string")
        .required()
        .prompt({
          type: "input",
          message: "What commit message?"
        })
    )
);

app.on("**", (args, opts) =>
  [
    opts.git && {
      name: "git add .",
      key: "add",
      handler: () => execa("git", ["add", "."])
    },
    opts.git && {
      name: "git commit",
      key: "commit",
      handler: () => execa("git", ["commit", "-m", args.message])
    },
    opts.npm && {
      name: "npm version",
      key: "version",
      handler: () => execa("npm", ["version", args.version])
    },
    opts.git && {
      name: "git push",
      key: "push",
      handler: () => execa("git", ["push"])
    },
    opts.npm && {
      name: "npm publish",
      key: "publish",
      handler: async task => {
        let otp = "";
        if (opts.otp) {
          const otpTask = task.task("Get OTP", "otp");
          try {
            const proc = await execaCommand(opts.otp);
            otp = proc.stdout;
          } catch (error) {
            otpTask.error(error);
          }
          otpTask.complete("Got OTP");
        }

        const args = ["publish"];
        if (opts.preid) args.push("--preid", opts.preid);
        if (otp) args.push("--otp", otp);
        return execa("npm", args);
      }
    }
  ].filter(Boolean)
);

export default app;
