import type { App } from '@slack/bolt';
import actions from './actions';
import commands from './commands';
import events from './events';

const registerListeners = (app: App) => {
  actions.register(app);
  commands.register(app);
  events.register(app);
};

export default registerListeners;
