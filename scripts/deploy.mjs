// npm run deploy [-- minor|major]: publishes the tool to npmjs from an up-to-date, clean main.
// If the version in package.json is already on npm it is raised first (patch unless told otherwise)
// and the bump is committed; a version raised in its PR is published as it is. npm publish runs
// prepublishOnly (tests, build, ToolBox validator). The release is tagged vX.Y.Z and pushed.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const run = (command) => execSync(command, { stdio: 'inherit' })
const read = (command) => execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const stop = (message) => { console.error(`\nDeploy stopped: ${message}`); process.exit(1) }
const pkg = () => JSON.parse(readFileSync('package.json', 'utf8'))
const isPublished = (version) => {
  try { return read(`npm view ${pkg().name}@${version} version`) === version } catch { return false } // E404: not published
}

const bump = process.argv[2] ?? 'patch'
if (!['patch', 'minor', 'major'].includes(bump)) stop(`unknown version bump "${bump}". Use patch, minor or major.`)
if (read('git branch --show-current') !== 'main') stop('publish from main (git checkout main).')
if (read('git status --porcelain')) stop('there are uncommitted changes. Commit or stash them first.')
run('git pull --ff-only')

try { console.log(`npm account: ${read('npm whoami')}`) } catch { run('npm login') }

run('npm test') // fail before the version is touched
if (isPublished(pkg().version)) {
  run(`npm version ${bump} --no-git-tag-version`)
  run(`git commit -am "Release v${pkg().version}"`)
}
const { name, version } = pkg()
run('npm publish')
if (!read(`git tag -l v${version}`)) run(`git tag -a v${version} -m "v${version}"`)
run('git push --follow-tags origin main')

console.log(`\n${name}@${version} is on npm.`)
console.log('ToolBox picks it up at 00:00 UTC, or now from My tools > ... > Trigger Update.')
