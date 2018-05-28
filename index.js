#! /usr/bin/env node

const inquirer = require('inquirer');
const execa = require('execa');
const ll = require('listr-log');
const argv = require('minimist')(process.argv.slice(2));

function getOptions() {
  const opts = {
    version: argv._[0],
    message: argv._[1] || argv.m
  };
  return inquirer.prompt([
    opts.version || {
      type: 'list',
      name: 'version',
      message: 'What version bump?',
      choices: ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease']
    },
    opts.message || {
      type: 'input',
      name: 'message',
      message: 'What commit message?'
    }
  ].filter(Boolean)).then(answers => Object.assign({}, answers, opts));
}

getOptions()
  .then(opts => {
    console.log(opts);
    ll.add = 'git add .';
    ll.start();
    return execa.shell('git add .').then(() => opts);
  })
  .catch(err => ll.add.error(err, true))
  .then(opts => {
    ll.add.complete('Added');
    ll.commit = 'git commit';
    return execa.shell(`git commit -m ${opts.message}`).then(() => opts);
  })
  .catch(err => ll.commit.error(err, true))
  .then(opts => {
    ll.commit.complete('Committed');
    ll.version = 'npm version';
    return execa.shell(`npm version ${opts.version}`).then(() => opts);
  })
  .catch(err => ll.version.error(err, true))
  .then(opts => {
    ll.version.complete('Versioned');
    return execa.shell('npm pack --json --dry-run').then(({ stdout }) => {
      const data = JSON.parse(stdout)[0];
      if (argv.y || argv.yes) return opts;
      ll.pause();
      process.stdout.write('Files to be included:\n');
      process.stdout.write(data.files.map(file => file.path).join('\n'));
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
        return opts;
      });
    });
  })
  .then(opts => {
    if (argv.offile || argv['dry-run']) return null;
    ll.push = 'git push';
    return execa.shell('git push').then(() => opts);
  })
  .catch(err => ll.push.error(err, true))
  .then(opts => {
    if (opts === null) return null;
    ll.publish = 'npm publish';
    return execa.shell('npm publish').then(() => opts);
  })
  .catch(err => ll.publish.error(err, true))
  .then(() => ll.publish.complete('Published'))
  .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
