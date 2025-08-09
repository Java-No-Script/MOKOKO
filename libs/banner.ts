import chalk from 'chalk';
import figlet from 'figlet';

export function printBanner(): void {
  console.log(
    chalk.green(
      figlet.textSync('MOKOKO', {
        font: "3D-ASCII",
        horizontalLayout: 'default',
      }),
    ),
  );

  console.log(
    chalk.yellow(
      figlet.textSync('START !', {
        font: "3D-ASCII",
        horizontalLayout: 'default',
      }),
    ),
  );
}

export default printBanner;