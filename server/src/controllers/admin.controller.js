const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');

// ---------------------------------------------------------------------------
// GET /api/admin  — platform-level stats for the Overview dashboard.
// ---------------------------------------------------------------------------
const getStats = async (req, res, next) => {
  try {
    const [
      totalJobs,
      activeJobs,
      totalApplications,
      totalUsers,
      pipeline,
    ] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: 'active' }),
      Application.countDocuments(),
      User.countDocuments(),
      Application.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const pipelineCounts = {};
    for (const { _id, count } of pipeline) {
      pipelineCounts[_id] = count;
    }

    return res.status(200).json({
      totalJobs,
      activeJobs,
      totalApplications,
      totalUsers,
      pipeline: pipelineCounts,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getStats };
