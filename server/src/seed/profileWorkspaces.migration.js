/**
 * HireFlow — profile workspace index migration (ONE-TIME, NOT YET APPLIED).
 * ---------------------------------------------------------------------------
 * WHAT THIS CHANGES
 *   profiles collection, exactly one index:
 *     DROP    userId_1  (unique)      -> allows one profile per (user, workspace)
 *     CREATE  userId_1_role_1 (unique)
 *
 * WHY
 *   An account now holds one Profile per workspace (its own jobseeker profile
 *   and its own recruiter profile). The old unique index on `userId` alone
 *   makes a second profile for the same account impossible, so it has to be
 *   replaced by the compound unique index declared in src/models/Profile.js.
 *
 * WHAT IT DOES *NOT* DO
 *   - It does not modify, rewrite, or delete any profile document.
 *   - It does not change User.role / User.workspaces.
 *   - It does not touch Application, SavedJob, or Job.
 *   Every existing Profile already carries a `role` value, so the new compound
 *   index is satisfied by all current data. That is why no backfill is needed:
 *   the migration is index-only.
 *
 * RECORDS AFFECTED
 *   Documents rewritten: 0
 *   Indexes dropped:      1  (profiles.userId_1)
 *   Indexes created:      1  (profiles.userId_1_role_1)
 *
 * SAFETY / IDEMPOTENCY
 *   - Re-running is safe: it only creates the compound index if missing, and
 *     drops the legacy index only if present.
 *   - It refuses to run against production unless
 *     PROFILE_WORKSPACES_ALLOW_PRODUCTION=true.
 *   - It performs a dry run by default; pass --apply to actually change
 *     anything.
 *
 * BACKUP BEFORE RUNNING (recommended)
 *   mongodump --uri="<your MONGODB_URI>" --db=<dbName> --collection=profiles \
 *              --out=./backup-profiles
 *   Also back up `users` if you want a full rollback path.
 *
 * ROLLBACK
 *   Recreating the old unique index requires that no account holds two
 *   profiles:
 *     node src/seed/profileWorkspaces.migration.js --rollback
 *   If accounts have since opened both workspaces, the rollback will FAIL on
 *   duplicate key errors — that is the intended safety stop, and the fix is to
 *   delete the surplus workspace profiles first (which loses data). Decide the
 *   rollback window before applying.
 *
 * USAGE
 *   node src/seed/profileWorkspaces.migration.js            # dry run, prints plan
 *   node src/seed/profileWorkspaces.migration.js --apply    # apply the change
 *   node src/seed/profileWorkspaces.migration.js --rollback # restore old index
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const mongoose = require('mongoose');
const env = require('../config/env');
const Profile = require('../models/Profile');

const APPLY = process.argv.includes('--apply');
const ROLLBACK = process.argv.includes('--rollback');

const LEGACY_INDEX = 'userId_1';
const COMPOUND_INDEX = 'userId_1_role_1';

const listProfileIndexes = async () =>
  (await Profile.collection.indexes()).map((i) => i.name);

const describeProfiles = async () => {
  const total = await Profile.countDocuments({});
  const missingRole = await Profile.countDocuments({ role: { $exists: false } });
  const byRole = await Profile.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]);
  const dupPairs = await Profile.aggregate([
    { $group: { _id: { userId: '$userId', role: '$role' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: 'pairs' },
  ]);
  return {
    total,
    missingRole,
    byRole: byRole.map((r) => `${r._id}=${r.n}`).join(', ') || '(none)',
    duplicatePairs: dupPairs.length ? dupPairs[0].pairs : 0,
  };
};

(async () => {
  try {
    if (env.nodeEnv === 'production' && process.env.PROFILE_WORKSPACES_ALLOW_PRODUCTION !== 'true') {
      throw new Error(
        'Refusing to run in production. Set PROFILE_WORKSPACES_ALLOW_PRODUCTION=true to override.'
      );
    }

    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    const dbName = mongoose.connection.name;
    console.log(`[migrate] connected to ${mongoose.connection.host}/${dbName}`);

    const indexes = await listProfileIndexes();
    const stats = await describeProfiles();
    console.log(`[migrate] profiles total=${stats.total} byRole=${stats.byRole}`);
    console.log(`[migrate] profiles missing a role: ${stats.missingRole}`);
    console.log(`[migrate] existing (userId, role) pairs with >1 profile: ${stats.duplicatePairs}`);
    console.log(`[migrate] current indexes: ${indexes.join(', ') || '(none)'}`);

    if (stats.missingRole > 0) {
      console.log(
        '[migrate] STOP: some profiles have no `role`. The compound index needs one. Investigate before applying.'
      );
      process.exitCode = 1;
      return;
    }

    if (ROLLBACK) {
      if (!indexes.includes(LEGACY_INDEX)) {
        console.log(`[migrate] ${LEGACY_INDEX} is already absent. Nothing to roll back.`);
        return;
      }
      if (!APPLY) {
        console.log(`[migrate] DRY RUN — would drop ${COMPOUND_INDEX} and recreate ${LEGACY_INDEX} (unique).`);
        console.log('[migrate] Re-run with --rollback --apply to execute.');
        return;
      }
      console.log(`[migrate] dropping ${COMPOUND_INDEX} ...`);
      await Profile.collection.dropIndex(COMPOUND_INDEX);
      console.log(`[migrate] recreating ${LEGACY_INDEX} (unique) ...`);
      await Profile.collection.createIndex({ userId: 1 }, { unique: true, name: LEGACY_INDEX });
      console.log('[migrate] rollback complete.');
      return;
    }

    const needsCreate = !indexes.includes(COMPOUND_INDEX);
    const needsDrop = indexes.includes(LEGACY_INDEX);

    if (!needsCreate && !needsDrop) {
      console.log('[migrate] nothing to do — indexes already in the target state.');
      return;
    }

    console.log('[migrate] PLAN:');
    if (needsDrop) console.log(`  - drop   ${LEGACY_INDEX} (unique on userId)`);
    if (needsCreate) console.log('  + create userId_1_role_1 (unique on userId + role)');
    console.log('  documents rewritten: 0');

    if (!APPLY) {
      console.log('[migrate] DRY RUN — nothing was changed. Re-run with --apply to execute.');
      return;
    }

    // Create the compound index FIRST: it is a strict superset of the legacy
    // constraint, so doing this before the drop can never leave the collection
    // less constrained than it started.
    if (needsCreate) {
      console.log('[migrate] creating userId_1_role_1 (unique) ...');
      await Profile.collection.createIndex(
        { userId: 1, role: 1 },
        { unique: true, name: COMPOUND_INDEX }
      );
    }
    if (needsDrop) {
      console.log(`[migrate] dropping ${LEGACY_INDEX} ...`);
      await Profile.collection.dropIndex(LEGACY_INDEX);
    }

    console.log('[migrate] done. indexes now: ' + (await listProfileIndexes()).join(', '));
  } catch (err) {
    console.error(`[migrate] failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
})();