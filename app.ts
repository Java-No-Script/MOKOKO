import { App, LogLevel } from '@slack/bolt';
import * as dotenv from 'dotenv';
import printBanner from './libs/banner';
import slackLogger from './libs/logger';
import registerListeners from './listeners';

dotenv.config();

/** Initialization */
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: LogLevel.DEBUG,
  logger: slackLogger,
});

/** Register Listeners */
registerListeners(app);

/** Start Bolt App */
(async () => {
  try {
    await app.start(process.env.PORT || 3000);
    app.logger.info('⚡️ Bolt app is running! ⚡️');
  } catch (error) {
    app.logger.error('Unable to start App', error);
  }
})().then(() => {
  printBanner();
});
