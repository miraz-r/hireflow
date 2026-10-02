/**
 * HireFlow — pre-migration backup for the profile workspace migration.
 * ---------------------------------------------------------------------------
 * Backs up the entire `profiles` collection (the only collection the
 * profile-workspaces migration touches, since it changes indexes only) to
 * BSON-extended JSON, so the documents can be restored losslessly:
 * ObjectId and Date values survive a JSON round trip via the $oid / $date
 * wrappers this format uses.
 *
 * This exists because `mongodump` is not available in this environment, so the
 * backup has to go through the same mongoose driver the app uses.
 *
 * It is read-only: it connects, reads, writes a file, and disconnects.
 *
 * USAGE
 *   npm run backup:profiles
 *   npm run backup:profiles -- --out ./some-dir
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('../config/env');
const Profile = require('../models/Profile');

const outArgIndex = process.argv.indexOf('--out');
const OUT_DIR =
  outArgIndex !== -1 && process.argv[outArgIndex + 1]
    ? path.resolve(process.argv[outArgIndex + 1])
    : path.join(__dirname, '..', '..', 'backups');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');

(async () => {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    const dbName = mongoose.connection.name;
    const host = mongoose.connection.host;
    console.log(`[backup] connected to ${host}/${dbName}`);

    // Record the exact indexes too, so a restore knows what to rebuild.
    const indexes = await Profile.collection.indexes();

    const docs = await Profile.collection.find({}).toArray();

    const payload = {
      meta: {
        collection: 'profiles',
        host,
        database: dbName,
        takenAt: new Date().toISOString(),
        documentCount: docs.length,
        indexes,
      },
      documents: docs,
    };

    const file = path.join(OUT_DIR, `profiles-${dbName}-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');

    // ---- Verify the backup before reporting success -----------------------
    const size = fs.statSync(file).size;
    const reparse = JSON.parse(fs.readFileSync(file, 'utf8'));
    const reparsedDocs = reparse.documents.length;
    const reparsedIds = new Set(
      reparse.documents.map((d) => (d._id && d._id.$oid ? d._id.$oid : String(d._id)))
    ).size;

    const ok =
      reparsedDocs === docs.length &&
      reparsedIds === docs.length &&
      size > 0;

    console.log(`[backup] file      : ${file}`);
    console.log(`[backup] documents : ${docs.length}`);
    console.log(`[backup] size      : ${size} bytes`);
    console.log(`[backup] verify    : re-parsed ${reparsedDocs} docs / ${reparsedIds} unique ids`);
    console.log(`[backup] indexes   : ${indexes.map((i) => `${i.name}${i.unique ? ' (unique)' : ''}`).join(', ')}`);

    if (!ok) {
      console.error('[backup] VERIFICATION FAILED — do not run the migration.');
      process.exitCode = 1;
      return;
    }
    console.log('[backup] OK');
  } catch (err) {
    console.error(`[backup] failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
})();