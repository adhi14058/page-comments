// The release's version numbers. The bookmark's is major.minor.patch and follows its code: changed code gets the next
// patch (or the bump asked for); unchanged code keeps its number, so nobody is told to update for nothing. The
// extension shares those three numbers (same core) and adds a fourth for a release where only its own files changed,
// because the stores refuse an upload whose version did not go up: bookmark 1.9.5, extension 1.9.5.1, 1.9.5.2, ...
const nextVersions = ({ last, hash, extHash, bump }) => {
  if (bump && !['major', 'minor', 'patch'].includes(bump)) throw new Error('usage: node bookmarklet/build.js [major|minor|patch]');
  const [major, minor, patch] = last.version.split('.').map(Number);
  const version = !bump && hash === last.hash ? last.version
    : bump === 'major' ? `${major + 1}.0.0` : bump === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
  // A release.json from before the extension had its own number starts it at the bookmark's.
  const ext = last.extension || { version: last.version, hash: extHash };
  const extVersion = version !== last.version ? version
    : extHash === ext.hash ? ext.version
    : `${version}.${Number(ext.version.split('.')[3] || 0) + 1}`;
  return { version, extVersion };
};

module.exports = { nextVersions };
