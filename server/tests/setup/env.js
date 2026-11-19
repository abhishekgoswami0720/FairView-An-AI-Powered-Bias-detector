// Runs before every test file, before any app code is loaded.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-only-for-tests';
process.env.RATE_LIMIT = 'off';       // rate limits would make fast tests fail
process.env.AUTO_ANALYSIS = 'false';  // tests run the analysis themselves when they need it
process.env.APP_URL = 'http://app.test';
delete process.env.SMTP_URL;          // emails go to the in-memory outbox
delete process.env.ML_URL;
