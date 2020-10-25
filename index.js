#! /usr/bin/env node

const inquirer = require('inquirer');
const execa = require('execa');
const ll = require('listr-log');
const argv = require('minimist')(process.argv.slice(2));

if (argv.npm === undefined) {
  argv.npm = true;
}

function getOptions() {
  const opts = {
    version: argv._[0],
    message: argv._[1] || argv.m
  };
  return inquirer.prompt([
    argv.npm && (opts.version || {
      type: 'list',
      name: 'version',
      message: 'What version bump?',
      choices: ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease']
    }),
    opts.message || {
      type: 'input',
      name: 'message',
      message: 'What commit message?'
    }
  ].filter(Boolean)).then(answers => Object.assign({}, opts, answers));
}

getOptions()
  .then(opts => {
    ll.add = 'git add .';
    // ll.start();
    return execa('git', ['add', '.']).then(() => opts);
  })
  .catch(err => ll.add.error(err, true))
  .then(opts => {
    ll.add.complete('Added');
    ll.commit = 'git commit';
    return execa('git', ['commit', '-m', opts.message]).then(({ stdout }) => [opts, stdout]);
  })
  .catch(err => ll.commit.error(err, true))
  .then(([opts, stdout]) => {
    ll.commit.complete(`Committed: ${stdout.split('\n')[0]}`);
    if (!argv.npm) return [opts];
    ll.version = 'npm version';
    return execa('npm', ['version', opts.version]).then(({ stdout }) => [opts, stdout]);
  })
  .catch(err => ll.version.error(err, true))
  .then(([opts, stdout]) => {
    if (argv.npm) ll.version.complete(`New version: ${stdout}`);
    if (argv.offline || argv['dry-run']) return null;
    if (!argv.npm) return opts;
    return execa('npm', ['pack', '--json', '--dry-run']).then(({ stdout }) => {
      console.log(stdout);
      const data = JSON.parse(stdout)[0];
      if (argv.y || argv.yes) return opts;
      ll.pause();
      process.stdout.write('Files to be included:\n');
      process.stdout.write(data.files.map(file => `  ${file.path}`).join('\n'));
      process.stdout.write('\n');
      return inquirer.prompt([
        {
          name: 'yes',
          type: 'confirm',
          message: 'Files above are to be included. Proceed?'
        }
      ]).then(hash => {
        if (!hash.yes) {
          process.stdout.write('Aborted.\n');
          process.exit(2);
        }
        ll.tasks.splice(0, 4);
        ll.play();
        return opts;
      });
    });
  })
  .then(opts => {
    if (opts === null) return null;
    ll.push = 'git push';
    return execa('git', ['push']).then(() => opts);
  })
  .catch(err => ll.push.error(err, true))
  .then(opts => {
    if (opts === null) return null;
    ll.push.complete('Push completed');
    if (!argv.npm) return null;
    ll.publish = 'npm publish';
    return execa('npm', ['publish']).then(() => opts);
  })
  .catch(err => ll.publish.error(err, true))
  .then(opts => (opts === null || ll.publish.complete('Published')))
  .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
