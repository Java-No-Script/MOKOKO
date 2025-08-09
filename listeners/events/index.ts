import type { App } from '@slack/bolt';
import appMentionCallback from './app-mention-callback';

const register = (app: App) => {
  app.event('app_mention', appMentionCallback);
};

export default { register };
