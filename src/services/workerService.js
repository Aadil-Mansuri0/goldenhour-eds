const logger = require('../logger');

class WorkerService {
  constructor() {
    this.jobs = [];
  }

  enqueue(name, payload) {
    this.jobs.push({ name, payload, createdAt: new Date().toISOString() });
    logger.info('Queued background job', { name, payload });
    return this.jobs.length;
  }

  processQueue() {
    for (const job of this.jobs) {
      logger.info('Processing job', { jobName: job.name, payload: job.payload });
      if (job.name === 'dispatch-notification') {
        logger.info('Dispatch notification sent', { incidentId: job.payload.incidentId });
      }
      if (job.name === 'hospital-update') {
        logger.info('Hospital status broadcasted', { hospitalId: job.payload.hospitalId });
      }
    }
    this.jobs = [];
    return true;
  }
}

module.exports = new WorkerService();
